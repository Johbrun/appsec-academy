// Tests de M18 · Surveillance, logging & SIEM.
//
// Deux familles, et il faut les distinguer :
//
//   · les tests de **structure** passent toujours. Ils vérifient le matériel
//     du module — les corpus se lisent, leur vérité terrain est cohérente, la
//     bibliothèque de règles s'analyse, les corrigés de référence obtiennent
//     bien la note qu'on leur prête, et le garde-fou anti-codage en dur refuse
//     ce qu'il doit refuser. Si l'un tombe, c'est le lab qui est cassé.
//
//   · les tests de **livrable** échouent tant que l'apprenant n'a pas écrit
//     ses fichiers dans `workspace/`. C'est leur rôle, comme pour les
//     challenges « fix » : l'échec nomme ce qui reste à produire.
//
// Aucun serveur n'est nécessaire : tout se joue sur des fichiers.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';
import { m18Checks } from '../server/audit/m18.ts';
import {
  evaluate, fxJson, fxList, fxNdjson, fxYaml, hardcodingError, loadCorpus, maliciousCount,
  parseRule, score, type Corpus, type Rule,
} from '../server/audit/detect.ts';
import { m18 } from '../shared/live/m18.ts';

const labRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOLUTIONS = path.join(labRoot, 'solutions/workspace');

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/** Une règle du corrigé de référence, lue sans passer par `workspace/`. */
function solutionRule(rel: string): Rule {
  const raw = fs.readFileSync(path.join(SOLUTIONS, rel), 'utf8');
  const parsed = parseRule(loadYaml(raw), rel);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  return parsed.value;
}

const noted = (rule: Rule, corpus: Corpus) => score(evaluate(rule, corpus.events), corpus);

// ── Structure : le catalogue ────────────────────────────────────────────────

describe('M18 · le catalogue des challenges', () => {
  it('chaque challenge a sa vérification, et réciproquement', () => {
    const declared = m18.map((e) => e.id).sort();
    const implemented = Object.keys(m18Checks).sort();
    assert.deepEqual(
      declared.filter((id) => !implemented.includes(id)), [],
      'challenges sans vérification',
    );
    assert.deepEqual(
      implemented.filter((id) => !declared.includes(id)), [],
      'vérifications orphelines',
    );
  });

  it('les identifiants sont uniques', () => {
    assert.equal(uniq(m18.map((e) => e.id)).length, m18.length);
  });

  it('chaque challenge est jouable, de type artifact, et complet', () => {
    for (const e of m18) {
      assert.equal(e.status, 'live', `${e.id} n’est pas live`);
      assert.equal(e.kind, 'artifact', `${e.id} n’est pas de type artifact`);
      assert.equal(e.module, 'm18', `${e.id} n’est pas rattaché à m18`);
      assert.equal(e.hints.length, 3, `${e.id} n’a pas trois indices`);
      for (const field of ['brief', 'goal', 'fix', 'file', 'cwe'] as const) {
        assert.ok(String(e[field]).trim().length > 0, `${e.id} : le champ ${field} est vide`);
      }
      assert.ok(e.lessons.length > 0, `${e.id} ne renvoie à aucune leçon`);
      assert.ok(e.csslp.length > 0, `${e.id} n’a pas de domaine CSSLP`);
    }
  });

  it('le chemin du livrable est relatif à workspace/, et le corrigé de référence l’occupe', () => {
    for (const e of m18) {
      assert.ok(!e.file.startsWith('workspace/'), `${e.id} : le chemin ne doit pas répéter le préfixe workspace/`);
      assert.ok(!path.isAbsolute(e.file), `${e.id} : le chemin doit être relatif`);
      const full = path.join(SOLUTIONS, e.file);
      assert.ok(fs.existsSync(full), `${e.id} : ${e.file} manque dans solutions/workspace/`);
      if (e.file.endsWith('/')) {
        assert.ok(fs.readdirSync(full).length > 0, `${e.id} : le dossier du corrigé est vide`);
      }
    }
  });
});

// ── Structure : les corpus ──────────────────────────────────────────────────

const CORPORA = ['cs', 'cs-holdout', 'cs-hard', 'spray', 'spray-holdout', 'graduated',
  'redaction', 'assistant', 'honeytoken', 'appsensor', 'silent-before', 'silent-after'];

describe('M18 · les corpus étiquetés', () => {
  for (const name of CORPORA) {
    it(`${name} se lit et sa vérité terrain est cohérente`, () => {
      const c = loadCorpus(name);
      assert.ok(c.events.length > 0, 'corpus vide');
      assert.ok(c.cases.length > 0, 'aucun cas étiqueté');
      const known = new Set(c.cases.map((k) => k.id));
      const orphans = uniq(c.events.map((ev) => String(ev._case))).filter((id) => !known.has(id));
      assert.deepEqual(orphans, [], 'événements rattachés à un cas inconnu');
      const used = new Set(c.events.map((ev) => String(ev._case)));
      const empty = c.cases.filter((k) => !used.has(k.id)).map((k) => k.id);
      assert.deepEqual(empty, [], 'cas sans aucun événement');
      const badTs = c.events.filter((ev) => Number.isNaN(Date.parse(String(ev['@timestamp']))));
      assert.equal(badTs.length, 0, 'horodatages illisibles');
    });
  }

  it('aucun cas ne partage son adresse source avec un autre', () => {
    // Deux cas qui partageraient une adresse partageraient un groupe : l'alerte
    // toucherait les deux, et la note deviendrait fausse.
    for (const name of ['cs', 'cs-holdout', 'cs-hard', 'spray', 'spray-holdout', 'graduated']) {
      const c = loadCorpus(name);
      const owner = new Map<string, string>();
      for (const ev of c.events) {
        const ip = String((ev.source as { ip?: string })?.ip ?? '');
        const caseId = String(ev._case);
        const previous = owner.get(ip);
        assert.ok(previous === undefined || previous === caseId, `${name} : ${ip} est partagée par ${previous} et ${caseId}`);
        owner.set(ip, caseId);
      }
    }
  });
});

// ── Structure : la bibliothèque de règles ───────────────────────────────────

describe('M18 · la bibliothèque de règles', () => {
  const ids = fxList('rules').filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''));

  it('compte douze règles, dont cinq s’écartent du corrigé', () => {
    assert.equal(ids.length, 12);
    // Le défaut n'est pas étiqueté dans la fixture — ce serait donner la
    // réponse. On le retrouve en comparant à la version réparée.
    const broken = ids.filter((id) => {
      const fixture = JSON.stringify(fxYaml(`rules/${id}.yaml`));
      const repaired = JSON.stringify(loadYaml(fs.readFileSync(path.join(SOLUTIONS, `detections/rules/${id}.yaml`), 'utf8')));
      return fixture !== repaired;
    });
    assert.equal(broken.length, 5, `règles à corriger : ${broken.join(', ')}`);
  });

  for (const id of ids) {
    it(`${id} : la requête s’analyse`, () => {
      const parsed = parseRule(fxYaml<{ query?: unknown }>(`rules/${id}.yaml`)?.query, id);
      assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
    });
  }

  it('le corrigé de référence conserve la requête de chaque règle', () => {
    for (const id of ids) {
      const fixture = fxYaml<{ query?: unknown }>(`rules/${id}.yaml`)?.query;
      const repaired = loadYaml(fs.readFileSync(path.join(SOLUTIONS, `detections/rules/${id}.yaml`), 'utf8')) as { query?: unknown };
      assert.deepEqual(repaired.query, fixture, `${id} : la requête du corrigé diffère de celle de la fixture`);
    }
  });
});

// ── Structure : les scénarios de couverture ─────────────────────────────────

describe('M18 · la couverture', () => {
  it('chaque scénario déclenche au moins une règle, et une seule règle reste découverte', () => {
    const ids = fxList('rules').filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''));
    const rules = ids.map((id) => {
      const parsed = parseRule(fxYaml<{ query?: unknown }>(`rules/${id}.yaml`)?.query, id);
      assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
      return { id, rule: parsed.value };
    });
    const covered = new Set<string>();
    const files = fxList('coverage/scenarios').filter((f) => f.endsWith('.ndjson'));
    assert.ok(files.length >= 8, 'scénarios de couverture manquants');
    for (const file of files) {
      const events = fxNdjson(`coverage/scenarios/${file}`);
      const fired = rules.filter((r) => evaluate(r.rule, events).length > 0).map((r) => r.id);
      assert.ok(fired.length > 0, `${file} ne déclenche aucune règle`);
      for (const id of fired) covered.add(id);
    }
    const holes = ids.filter((id) => !covered.has(id));
    assert.deepEqual(holes, ['rate-limit-exceeded'], 'le trou de couverture attendu a changé');
  });

  it('le catalogue ATT&CK distingue les techniques dépréciées', () => {
    const list = fxJson<{ techniques: { id: string; deprecated: boolean }[] }>('coverage/attack.json')?.techniques ?? [];
    assert.ok(list.length > 10);
    assert.ok(list.some((t) => t.deprecated), 'aucune technique dépréciée : le piège du challenge disparaît');
  });
});

// ── Structure : l'incident ──────────────────────────────────────────────────

describe('M18 · le journal d’incident', () => {
  it('les quatorze événements de la vérité terrain existent et sont en ordre', () => {
    const raw = fs.readFileSync(path.join(SOLUTIONS, 'incident/timeline.yaml'), 'utf8');
    const truth = (loadYaml(raw) as { evenements: string[] }).evenements;
    assert.equal(truth.length, 14);
    const log = fxNdjson('incident/log.ndjson');
    const byId = new Map(log.map((ev) => [String((ev.event as { id?: string })?.id), ev]));
    for (const id of truth) assert.ok(byId.has(id), `${id} n’existe pas dans le journal`);
    const stamps = truth.map((id) => String(byId.get(id)!['@timestamp']));
    assert.deepEqual(stamps, [...stamps].sort(), 'la vérité terrain n’est pas chronologique');
  });

  it('le journal est assez gros pour que l’exercice en soit un', () => {
    assert.ok(fxNdjson('incident/log.ndjson').length > 500);
  });
});

// ── Structure : les corrigés de référence obtiennent bien leur note ─────────

describe('M18 · les corrigés de référence', () => {
  const cases: [string, string, string[]][] = [
    ['bourrage d’identifiants', 'detections/credential-stuffing.yaml', ['cs', 'cs-holdout']],
    ['pulvérisage', 'detections/password-spray.yaml', ['spray', 'spray-holdout']],
    ['honeytoken', 'detections/honeytoken.yaml', ['honeytoken']],
    ['injection indirecte', 'detections/prompt-injection.yaml', ['assistant']],
  ];
  for (const [label, rel, corpora] of cases) {
    it(`${label} : précision et rappel parfaits sur ${corpora.join(' et ')}`, () => {
      const rule = solutionRule(rel);
      for (const name of corpora) {
        const c = loadCorpus(name);
        const s = noted(rule, c);
        assert.equal(s.fp.length, 0, `${name} : ${s.fp.map((k) => k.label).join(', ')}`);
        assert.equal(s.tp.length, maliciousCount(c), `${name} : ${s.fn.map((k) => k.label).join(', ')}`);
      }
    });
  }

  it('la règle réécrite après correctif lève avant et se tait après', () => {
    const rule = solutionRule('detections/idor-probing.yaml');
    const before = loadCorpus('silent-before');
    assert.equal(noted(rule, before).tp.length, maliciousCount(before));
    assert.equal(noted(rule, before).fp.length, 0);
    assert.equal(evaluate(rule, loadCorpus('silent-after').events).length, 0);
  });

  it('la règle d’origine, elle, lève encore après le correctif', () => {
    // Sans ça, le challenge n'aurait pas d'objet.
    const parsed = parseRule(fxYaml('silent-before/rule-origine.yaml'), 'règle d’origine');
    assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
    assert.ok(evaluate(parsed.value, loadCorpus('silent-after').events).length > 0);
  });
});

// ── Structure : le garde-fou anti-codage en dur ─────────────────────────────

describe('M18 · le codage en dur est refusé', () => {
  const cs = loadCorpus('cs');
  const attackerIps = uniq(
    cs.events.filter((ev) => String(ev._case).startsWith('attaque'))
      .map((ev) => String((ev.source as { ip?: string }).ip)),
  );
  const attackerEventIds = cs.events
    .filter((ev) => String(ev._case).startsWith('attaque'))
    .map((ev) => String((ev.event as { id?: string }).id));

  const refuse = (raw: unknown, why: string) => {
    const parsed = parseRule(raw, 'triche');
    assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
    assert.notEqual(hardcodingError(parsed.value, [cs]), null, why);
  };

  it('une règle qui nomme un champ d’identifiant est refusée', () => {
    refuse({ where: [{ field: 'event.id', op: 'in', value: attackerEventIds }] }, 'event.id accepté');
    refuse({ where: [{ field: '_case', op: 'starts_with', value: 'attaque' }] }, '_case accepté');
    refuse({ where: [{ field: 'labels', op: 'exists' }] }, 'labels accepté');
  });

  it('une règle qui découpe l’attaque à l’horodatage est refusée', () => {
    refuse({ where: [{ field: '@timestamp', op: 'gte', value: '2026-03-04T09:00:00Z' }] }, '@timestamp accepté');
  });

  it('une règle qui cite un identifiant d’événement en valeur est refusée', () => {
    refuse({ where: [{ field: 'url.path', op: 'in', value: attackerEventIds.slice(0, 5) }] }, 'valeur d’identifiant acceptée');
  });

  it('une règle qui énumère les adresses des attaquants ne survit pas au second corpus', () => {
    // Celle-là passe le garde-fou statique : c'est le second corpus qui tranche.
    const parsed = parseRule({ where: [{ field: 'source.ip', op: 'in', value: attackerIps }] }, 'triche');
    assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
    assert.equal(hardcodingError(parsed.value, [cs]), null);
    assert.equal(noted(parsed.value, loadCorpus('cs')).tp.length, 12);
    assert.equal(noted(parsed.value, loadCorpus('cs-holdout')).tp.length, 0);
  });
});

// ── Livrables : échouent tant que l'apprenant n'a rien écrit ────────────────

describe('M18 · les livrables sont produits', () => {
  for (const e of m18) {
    it(`${e.id} · ${e.title}`, () => {
      const reason = m18Checks[e.id]();
      assert.equal(reason, null, reason ?? '');
    });
  }
});
