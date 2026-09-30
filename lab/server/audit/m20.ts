// Vérifications des challenges M20 · Capstone.
//
// Le capstone n'est pas une somme d'exercices : c'est la revue de sécurité
// complète de Novafact, et ce qui le rend vérifiable est le **chaînage** —
// chaque étape réutilise les livrables des précédentes, et une incohérence
// entre deux étapes se voit.
//
//   · l'étape 3 relit la classification de l'étape 1 : tout actif classé
//     sensible doit apparaître dans le modèle de menaces ;
//   · l'étape 11 relit les constats de l'étape 4 : toute classe de bugs
//     trouvée doit être adressée par une activité du plan.
//
// Trois étapes se jugent en **exécutant** ce que l'apprenant a écrit, contre
// des jeux que le harnais fabrique à chaque audit avec des identités tirées au
// sort : la règle de l'étape 4, les contrôles anti-abus de l'étape 6, les
// détections de l'étape 10. C'est ce qui interdit de coder le résultat en dur.
//
// Deux choses ne sont pas notées, et les énoncés le disent : la restitution à
// une direction (étape 12), et la pertinence des arbitrages de conception
// (étape 2) — seule leur traçabilité l'est.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LAB_ROOT, WORKSPACE, missing, run, wsJson, wsText, wsYaml } from './workspace.ts';
import {
  appRoutes, arr, few, fixture, labExists, labText, str, strs, stripComments, uniq, ws,
  type Check, type Doc,
} from './m11.ts';

// ── Utilitaires ─────────────────────────────────────────────────────────────

const num = (v: unknown): number => (typeof v === 'number' ? v : Number.NaN);

/** Charge un YAML de l'espace de travail, avec le message qui va bien. */
function yaml(rel: string): { doc: Doc } | { err: string } {
  return ws(rel);
}

function json(rel: string): { doc: Doc } | { err: string } {
  const r = wsJson<Doc>(rel);
  if (r === null) return { err: missing(rel) };
  if ('error' in r) return { err: `le livrable \`workspace/${rel}\` ${r.error}` };
  if (!r.value || typeof r.value !== 'object') return { err: `le livrable \`workspace/${rel}\` est vide` };
  return { doc: r.value };
}

/**
 * Exécute un module écrit par l'apprenant, dans un processus séparé.
 *
 * Le harnais fabrique un lanceur qui importe le module, lui passe un jeu de
 * données et imprime le résultat en JSON. L'apprenant exécute son propre code
 * sur sa propre machine : c'est l'objet de l'exercice.
 */
function callModule(
  rel: string,
  body: (modUrl: string, inputPath: string) => string,
  input: unknown,
  timeoutMs = 30_000,
): { value: unknown } | { err: string } {
  const mod = path.join(WORKSPACE, rel);
  if (!fs.existsSync(mod)) return { err: missing(rel) };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'capstone-'));
  try {
    const inputPath = path.join(tmp, 'input.json');
    fs.writeFileSync(inputPath, JSON.stringify(input));
    const runner = path.join(tmp, 'runner.mjs');
    fs.writeFileSync(runner, body(pathToFileURL(mod).href, pathToFileURL(inputPath).href));
    // La sortie est du JSON : la troncature par défaut la rendrait illisible.
    const r = run(process.execPath, [runner], { maxOutput: 400_000, timeoutMs });
    if (r.timedOut) return { err: `\`workspace/${rel}\` ne rend pas la main (délai dépassé)` };
    const line = r.output.split('\n').filter((l) => l.startsWith('{"__result__"')).pop();
    if (!line) {
      const tail = r.output.trim().split('\n').slice(-2).join(' ').slice(0, 200);
      return { err: `\`workspace/${rel}\` n’a pas pu être exécuté : ${tail || 'aucune sortie'}` };
    }
    return { value: (JSON.parse(line) as { __result__: unknown }).__result__ };
  } catch (err) {
    return { err: `\`workspace/${rel}\` n’a pas pu être exécuté : ${(err as Error).message}` };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Générateur déterministe pour un tirage donné — reproductible dans un audit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length) % xs.length];
const word = (r: () => number, n = 6) =>
  Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(r() * 26)]).join('');

// ── Chemins des livrables ───────────────────────────────────────────────────

const S1 = 'capstone/01-requirements';
const S2 = 'capstone/02-design';
const S3 = 'capstone/03-threats';
const S4 = 'capstone/04-review';
const S5 = 'capstone/05-payment';
const S6 = 'capstone/06-abuse';
const S7 = 'capstone/07-pipeline';
const S8 = 'capstone/08-iam';
const S10 = 'capstone/10-detections';
const S11 = 'capstone/11-roadmap';
const S12 = 'capstone/12-adoption';

const SENSITIVE = new Set(['confidentiel', 'personnel', 'secret']);
const CLASSES = new Set(['public', 'interne', 'confidentiel', 'personnel', 'secret']);

/** Les champs des entités du modèle de données, relus dans le code. */
function entityFields(entity: string): string[] {
  const src = stripComments(labText('server/store.ts') ?? '');
  const m = new RegExp(`export interface ${entity}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src);
  if (!m) return [];
  return uniq([...m[1].matchAll(/^\s*(\w+)\??\s*:/gm)].map((x) => x[1]));
}

/** La classification de l'étape 1, relue depuis l'espace de travail. */
function classification(): Map<string, string> | null {
  const r = wsYaml<Doc>(`${S1}/data-classification.yaml`);
  if (r === null || 'error' in r) return null;
  const out = new Map<string, string>();
  for (const f of arr((r.value as Doc).fields)) {
    const name = str(f.name);
    if (name) out.set(`${str(f.entity)}.${name}`, str(f.classification));
  }
  return out;
}

// ── Politiques IAM : un évaluateur minimal ──────────────────────────────────

interface Statement { Effect?: string; Action?: unknown; Resource?: unknown; Condition?: unknown }

const globMatch = (pattern: string, value: string) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i').test(value);

const statementsOf = (doc: Doc): Statement[] => {
  const raw = doc.Statement;
  return (Array.isArray(raw) ? raw : raw ? [raw] : []) as Statement[];
};

const matchesAction = (st: Statement, action: string) =>
  strs(st.Action).some((a) => globMatch(a, action));
const matchesResource = (st: Statement, resource: string) =>
  strs(st.Resource).some((r) => globMatch(r, resource));

// ── Contenu de sécurité d'une politique de contenu (CSP) ────────────────────

const parseCsp = (raw: string): Map<string, string[]> => {
  const out = new Map<string, string[]>();
  for (const part of raw.replace(/\s+/g, ' ').split(';')) {
    const tokens = part.trim().split(' ').filter(Boolean);
    if (!tokens.length) continue;
    out.set(tokens[0].toLowerCase(), tokens.slice(1));
  }
  return out;
};

const PAGE_ORIGIN = 'https://pay.novafact.example';

function cspAllows(csp: Map<string, string[]>, directive: string, url: string): boolean {
  const sources = csp.get(directive) ?? csp.get('default-src');
  if (!sources || sources.includes("'none'")) return false;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  for (const s of sources) {
    if (s === "'self'" && origin === PAGE_ORIGIN) return true;
    if (s === '*' || s === 'https:') return true;
    if (s.startsWith("'")) continue;
    const candidate = s.includes('://') ? s : `https://${s}`;
    try {
      if (new URL(candidate.replace('*.', 'wildcard.')).origin === origin) return true;
    } catch { /* source mal formée : ignorée */ }
    if (s.includes('*.')) {
      const suffix = s.replace(/^https?:\/\//, '').replace('*.', '');
      if (new URL(url).hostname.endsWith(`.${suffix}`)) return true;
    }
  }
  return false;
}

// ═══ Les vérifications ══════════════════════════════════════════════════════

export const m20Checks: Record<string, Check> = {
  // ── Étape 1 · Exigences et traçabilité ──────────────────────────────────

  'capstone-requirements': () => {
    const cls = yaml(`${S1}/data-classification.yaml`);
    if ('err' in cls) return cls.err;
    const asvs = yaml(`${S1}/asvs.yaml`);
    if ('err' in asvs) return asvs.err;
    const trace = wsText(`${S1}/traceability.csv`);
    if (trace === null) return missing(`${S1}/traceability.csv`);

    // La classification doit couvrir les entités du modèle de données, telles
    // que `server/store.ts` les déclare — pas une liste inventée.
    const classified = new Map<string, string>();
    for (const f of arr(cls.doc.fields)) {
      const name = str(f.name);
      const entity = str(f.entity);
      const level = str(f.classification);
      if (!name || !entity) return `un champ de la classification n’a ni nom ni entité`;
      if (!CLASSES.has(level)) return `« ${level || '(vide)'} » n’est pas un niveau de classification (${[...CLASSES].join(', ')})`;
      classified.set(`${entity}.${name}`, level);
    }
    for (const entity of ['User', 'Invoice']) {
      const fields = entityFields(entity);
      if (!fields.length) return `l’entité ${entity} n’a pas pu être relue dans server/store.ts : vérification impossible`;
      const holes = fields.filter((f) => !classified.has(`${entity}.${f}`));
      if (holes.length) return `des champs de ${entity} ne sont pas classés : ${few(holes)}`;
      const ghosts = [...classified.keys()].filter((k) => k.startsWith(`${entity}.`) && !fields.includes(k.split('.')[1]));
      if (ghosts.length) return `des champs classés n’existent pas dans ${entity} : ${few(ghosts)}`;
    }

    const reqs = arr(asvs.doc.requirements);
    if (reqs.length < 10) return `le sous-ensemble ASVS ne contient que ${reqs.length} exigences : il en faut au moins 10`;
    const ids = new Set<string>();
    const chapters = new Set<string>();
    const covered = new Set<string>();
    for (const q of reqs) {
      const id = str(q.id).toUpperCase();
      if (!/^V\d+\.\d+\.\d+$/.test(id)) return `« ${id || '(vide)'} » n’est pas un identifiant d’exigence ASVS (VX.Y.Z)`;
      if (ids.has(id)) return `l’exigence ${id} apparaît deux fois`;
      ids.add(id);
      chapters.add(id.split('.')[0]);
      if (str(q.statement).length < 15) return `l’exigence ${id} n’est pas énoncée`;
      const proof = str(q.verified_by);
      if (!proof || !labExists(proof)) return `l’exigence ${id} est vérifiée par « ${proof || '(rien)'} », qui n’est pas un fichier du dépôt`;
      for (const c of strs(q.covers)) covered.add(c);
    }
    if (chapters.size < 3) return `les exigences viennent de ${chapters.size} chapitres ASVS : il en faut au moins 3`;

    const sensitive = [...classified.entries()].filter(([, l]) => SENSITIVE.has(l)).map(([k]) => k);
    if (!sensitive.length) return 'aucun champ n’est classé sensible : la classification ne sert alors à rien';
    const uncovered = sensitive.filter((k) => !covered.has(k));
    if (uncovered.length) return `des données sensibles ne sont couvertes par aucune exigence : ${few(uncovered)}`;

    const rows = trace.split('\n').map((l) => l.trim()).filter(Boolean);
    if (rows.length < 2) return `le livrable \`workspace/${S1}/traceability.csv\` est vide`;
    const header = rows[0].split(',').map((c) => c.trim().toLowerCase());
    for (const c of ['exigence', 'actif', 'preuve']) {
      if (!header.includes(c)) return `l’en-tête de la matrice de traçabilité n’a pas la colonne ${c}`;
    }
    const traced = new Set<string>();
    for (const row of rows.slice(1)) {
      const cells = row.split(',').map((c) => c.trim());
      const id = (cells[header.indexOf('exigence')] ?? '').toUpperCase();
      if (!ids.has(id)) return `la matrice trace « ${id || '(vide)'} », qui n’est pas une des exigences retenues`;
      const proof = cells[header.indexOf('preuve')] ?? '';
      if (!labExists(proof)) return `la preuve « ${proof || '(vide)'} » de ${id} n’est pas un fichier du dépôt`;
      traced.add(id);
    }
    const untraced = [...ids].filter((id) => !traced.has(id));
    if (untraced.length) return `des exigences n’ont aucune ligne dans la matrice : ${few(untraced)}`;
    return null;
  },

  // ── Étape 2 · Design doc et revue de conception ─────────────────────────

  'capstone-design-review': () => {
    const template = fixture<{ headings: string[] }>('m20/design-template.json');
    if (!template) return 'la fixture fixtures/m20/design-template.json est absente : vérification impossible';

    const design = wsText(`${S2}/design.md`);
    if (design === null) return missing(`${S2}/design.md`);
    const absent = template.headings.filter((h) => !new RegExp(`^##+\\s+${h}\\s*$`, 'm').test(design));
    if (absent.length) return `le design doc n’a pas les rubriques du gabarit : ${few(absent)}`;

    // Les éléments de conception, déclarés dans le design doc lui-même.
    const section = /^##+\s+Éléments\s*$([\s\S]*?)(?=^##+\s|\Z)/m.exec(design);
    const elements = new Set(
      [...(section?.[1] ?? '').matchAll(/^[-*]\s+`?([a-z0-9][a-z0-9-]*)`?\s*[—:-]/gm)].map((m) => m[1]),
    );
    if (elements.size < 4) return `le design doc ne déclare que ${elements.size} éléments sous « Éléments » (attendu : « - identifiant — description »)`;

    const review = yaml(`${S2}/review.yaml`);
    if ('err' in review) return review.err;
    const findings = arr(review.doc.findings);
    if (findings.length < 6) return `la revue ne contient que ${findings.length} constats : il en faut au moins 6`;

    const CLASSES2 = new Set(['must', 'ought', 'should']);
    const seenClasses = new Set<string>();
    let divergences = 0;
    for (const f of findings) {
      const element = str(f.element);
      if (!elements.has(element)) return `le constat cite l’élément « ${element || '(vide)'} », qui n’est pas déclaré dans le design doc`;
      const cls = str(f.class).toLowerCase();
      if (!CLASSES2.has(cls)) return `« ${str(f.class) || '(vide)'} » n’est pas une classe de constat (must, ought, should)`;
      seenClasses.add(cls);
      if (str(f.finding).length < 20) return `un constat sur « ${element} » n’est pas décrit`;
      if (cls === 'must' && str(f.position_designer).length < 10) {
        return `le constat « must » sur « ${element} » ne trace pas la position du concepteur : le designer a le dernier mot, encore faut-il l’écrire`;
      }
      if (f.desaccord === true) {
        if (str(f.position_revue).length < 10 || str(f.position_designer).length < 10) {
          return `le désaccord sur « ${element} » ne documente pas les deux positions`;
        }
        divergences++;
      }
    }
    const missingClasses = [...CLASSES2].filter((c) => !seenClasses.has(c));
    if (missingClasses.length) return `aucun constat n’est classé ${missingClasses.join(', ')} : les trois niveaux servent à quelque chose`;
    if (divergences === 0) return 'aucune position divergente n’est documentée : une revue qui ne diverge jamais n’est pas une revue';
    return null;
  },

  // ── Étape 3 · Threat model ──────────────────────────────────────────────

  'capstone-threat-model': () => {
    const cls = classification();
    if (cls === null) return `l’étape 1 n’est pas faite : \`workspace/${S1}/data-classification.yaml\` est absent ou illisible`;
    const sensitive = [...cls.entries()].filter(([, l]) => SENSITIVE.has(l)).map(([k]) => k);
    if (!sensitive.length) return 'la classification de l’étape 1 ne marque aucune donnée sensible : le modèle n’a rien à protéger';

    const m = yaml(`${S3}/model.yaml`);
    if ('err' in m) return m.err;

    // Cohérence avec l'étape 1 : tout actif sensible apparaît dans le modèle.
    const assets = strs(m.doc.assets);
    const forgotten = sensitive.filter((k) => !assets.includes(k));
    if (forgotten.length) {
      return `des données classées sensibles à l’étape 1 n’apparaissent pas dans le modèle : ${few(forgotten)}`;
    }
    const invented = assets.filter((a) => !cls.has(a));
    if (invented.length) return `le modèle protège des actifs qui ne sont pas classés à l’étape 1 : ${few(invented)}`;

    // Cohérence avec le code : chaque route montée est couverte.
    const routes = appRoutes();
    if (!routes.length) return 'les routes de Novafact n’ont pas pu être relues : vérification impossible';
    const elements = arr(m.doc.elements);
    if (!elements.length) return `\`${S3}/model.yaml\` ne déclare aucun élément`;
    const ids = new Set<string>();
    const covered = new Map<string, string>();
    for (const e of elements) {
      const id = str(e.id);
      if (!id) return 'un élément du modèle n’a pas d’identifiant';
      if (ids.has(id)) return `l’élément « ${id} » est déclaré deux fois`;
      ids.add(id);
      if (!str(e.boundary)) return `l’élément « ${id} » n’est rattaché à aucune frontière de confiance`;
      for (const k of strs(e.routes)) {
        if (covered.has(k)) return `la route ${k} est rattachée à deux éléments`;
        covered.set(k, id);
      }
    }
    const bogus = [...covered.keys()].filter((k) => !routes.some((x) => x.key === k));
    if (bogus.length) return `le modèle décrit des routes qui n’existent pas : ${few(bogus)}`;
    const holes = routes.filter((x) => !covered.has(x.key)).map((x) => x.key);
    if (holes.length) return `des routes réellement montées ne sont couvertes par aucun élément : ${few(holes)}`;

    const threats = arr(m.doc.threats);
    if (!threats.length) return `\`${S3}/model.yaml\` ne retient aucune menace`;
    const perElement = new Map<string, number>();
    for (const t of threats) {
      const el = str(t.element);
      if (!ids.has(el)) return `une menace porte sur « ${el || '(vide)'} », qui n’est pas un élément du modèle`;
      if (str(t.threat).length < 15) return `une menace de « ${el} » n’est pas décrite`;
      const mitigation = strs(t.mitigation);
      if (mitigation.length !== 1) {
        return `la menace de « ${el} » a ${mitigation.length} mitigations : une menace retenue en porte exactement une`;
      }
      perElement.set(el, (perElement.get(el) ?? 0) + 1);
    }
    const silent = [...ids].filter((id) => !perElement.has(id));
    if (silent.length) return `des éléments du modèle ne portent aucune menace : ${few(silent)}`;
    return null;
  },

  // ── Étape 4 · Revue de PR, règles et tests ──────────────────────────────

  'capstone-code-review': () => {
    const diff = labText('fixtures/m20/pr-77.diff');
    const truth = fixture<{ blockers: { lines: number[]; cwe: string; what: string }[]; decoys: { line: number; why: string }[] }>('m20/pr-77.json');
    if (diff === null || !truth) return 'les fixtures de la PR du capstone sont absentes : vérification impossible';

    const review = yaml(`${S4}/review.yaml`);
    if ('err' in review) return review.err;
    const findings = arr(review.doc.findings);
    if (!findings.length) return `\`${S4}/review.yaml\` ne contient aucun constat`;

    const verdicts = new Map<number, { verdict: string; cwe: string }>();
    for (const f of findings) {
      const line = Number(f.line);
      if (!Number.isFinite(line)) return 'un constat de la revue n’a pas de ligne';
      verdicts.set(line, { verdict: str(f.verdict), cwe: str(f.cwe).toUpperCase() });
    }
    for (const b of truth.blockers) {
      const hit = b.lines.map((l) => verdicts.get(l)).find((v) => v?.verdict === 'bloquant');
      if (!hit) return `un défaut bloquant n’a pas été vu, ligne ${b.lines.join(' ou ')} : ${b.what}`;
      if (hit.cwe !== b.cwe) return `ligne ${b.lines[0]} : ${hit.cwe || '(aucun CWE)'} n’est pas la classe de ce défaut`;
    }
    for (const d of truth.decoys) {
      if (verdicts.get(d.line)?.verdict === 'bloquant') {
        return `ligne ${d.line} marquée bloquante alors que c’est ${d.why}`;
      }
    }

    // La règle, notée contre des jeux fabriqués à chaque audit : identifiants
    // tirés au sort, donc rien à coder en dur.
    const r = rng(Date.now() & 0xffff);
    const cases: { code: string; vulnerable: boolean }[] = [];
    for (let i = 0; i < 8; i++) {
      const coll = word(r, 7);
      const ent = word(r, 5);
      const v = word(r, 2);
      cases.push({
        vulnerable: true,
        code: [
          `${coll}Routes.get('/:id', (req, res) => {`,
          `  const ${ent} = db.${coll}.find((${v}) => ${v}.id === req.params.id);`,
          `  if (!${ent}) { res.status(404).json({ error: 'introuvable' }); return; }`,
          `  res.json(${ent});`,
          `});`,
        ].join('\n'),
      });
      cases.push({
        vulnerable: false,
        code: [
          `${coll}Routes.get('/:id', (req, res) => {`,
          `  const ${ent} = db.${coll}.find((${v}) => ${v}.id === req.params.id && ${v}.tenantId === req.user.tenantId);`,
          `  if (!${ent}) { res.status(404).json({ error: 'introuvable' }); return; }`,
          `  res.json(${ent});`,
          `});`,
        ].join('\n'),
      });
    }
    // …et des cas très proches qui ne doivent PAS être signalés.
    for (let i = 0; i < 4; i++) {
      const coll = word(r, 7);
      const ent = word(r, 5);
      const v = word(r, 2);
      cases.push({
        vulnerable: false,
        code: [
          `${coll}Routes.get('/:id', (req, res) => {`,
          `  const ${ent} = db.${coll}.find((${v}) => ${v}.id === req.params.id);`,
          `  if (!${ent} || ${ent}.tenantId !== req.user.tenantId) { res.status(404).json({}); return; }`,
          `  res.json(${ent});`,
          `});`,
        ].join('\n'),
      });
    }

    const out = callModule(
      `${S4}/rule.mjs`,
      (mod, input) => `
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const rule = await import(${JSON.stringify(mod)});
const cases = JSON.parse(readFileSync(fileURLToPath(${JSON.stringify(input)}), 'utf8'));
const fn = rule.check ?? rule.default;
if (typeof fn !== 'function') { console.log(JSON.stringify({ __result__: { error: 'la règle n’exporte pas check()' } })); process.exit(0); }
const results = cases.map((c, i) => {
  try { const hits = fn(c.code, 'snippet-' + i + '.ts'); return Array.isArray(hits) ? hits.length : 0; }
  catch (err) { return { error: String(err && err.message) }; }
});
console.log(JSON.stringify({ __result__: results }));
`,
      cases,
    );
    if ('err' in out) return out.err;
    const results = out.value as (number | { error: string })[];
    if (!Array.isArray(results)) return `\`${S4}/rule.mjs\` doit exporter une fonction check(code, fichier) qui renvoie la liste des constats`;
    const broken = results.find((x) => typeof x === 'object');
    if (broken) return `la règle a levé sur un cas : ${(broken as { error: string }).error}`;

    const missed = cases.filter((c, i) => c.vulnerable && (results[i] as number) === 0).length;
    const falsePositives = cases.filter((c, i) => !c.vulnerable && (results[i] as number) > 0).length;
    if (missed) return `la règle manque ${missed} des ${cases.filter((c) => c.vulnerable).length} cas vulnérables : elle est trop étroite`;
    if (falsePositives) return `la règle signale ${falsePositives} cas sains sur ${cases.filter((c) => !c.vulnerable).length} : elle est trop large, et une règle trop large finit désactivée`;
    return null;
  },

  // ── Étape 5 · Page de paiement ──────────────────────────────────────────

  'capstone-payment-page': () => {
    const ref = fixture<{ scripts: { url: string; role: string }[]; psp_frame: string }>('m20/payment-scripts.json');
    if (!ref) return 'la fixture fixtures/m20/payment-scripts.json est absente : vérification impossible';

    const inv = yaml(`${S5}/inventory.yaml`);
    if ('err' in inv) return inv.err;
    const listed = arr(inv.doc.scripts);
    const byUrl = new Map(listed.map((s) => [str(s.url), s]));
    const absent = ref.scripts.filter((s) => !byUrl.has(s.url)).map((s) => s.url);
    if (absent.length) return `des scripts chargés par la page de paiement ne sont pas à l’inventaire : ${few(absent)}`;
    const ghost = [...byUrl.keys()].filter((u) => !ref.scripts.some((s) => s.url === u));
    if (ghost.length) return `l’inventaire contient des scripts que la page ne charge pas : ${few(ghost)}`;
    for (const s of listed) {
      if (str(s.owner).length < 3) return `le script ${str(s.url)} n’a pas de propriétaire à l’inventaire (exigence 6.4.3)`;
      if (!/^sha384-[A-Za-z0-9+/]{64}=*$/.test(str(s.integrity))) {
        return `le script ${str(s.url)} n’a pas d’empreinte sha384 exploitable : sans elle, on ne détecte pas la modification (exigence 11.6.1)`;
      }
      if (!str(s.justification)) return `le script ${str(s.url)} n’a pas de justification de présence sur la page de paiement`;
    }

    const raw = wsText(`${S5}/csp.txt`);
    if (raw === null) return missing(`${S5}/csp.txt`);
    if (raw.trim().length < 20) return `le livrable \`workspace/${S5}/csp.txt\` est vide`;
    const csp = parseCsp(raw);

    const scriptSrc = csp.get('script-src') ?? csp.get('default-src');
    if (!scriptSrc) return 'la CSP n’a ni script-src ni default-src : elle ne contraint rien';
    for (const bad of ["'unsafe-inline'", "'unsafe-eval'", '*', 'data:', 'https:']) {
      if (scriptSrc.includes(bad)) return `script-src contient ${bad} : la politique ne bloque plus les charges utiles connues`;
    }
    for (const [d, expected] of [['object-src', ["'none'"]], ['base-uri', ["'none'", "'self'"]], ['frame-ancestors', ["'none'", "'self'"]]] as const) {
      const v = csp.get(d);
      if (!v || !v.some((x) => (expected as readonly string[]).includes(x))) {
        return `la directive ${d} manque ou est trop large (attendu : ${expected.join(' ou ')})`;
      }
    }

    // La politique doit laisser passer ce que la page charge vraiment…
    for (const s of ref.scripts) {
      if (!cspAllows(csp, 'script-src', s.url)) return `la CSP bloque ${s.url}, qui est à l’inventaire : le paiement ne fonctionnerait plus`;
    }
    if (!cspAllows(csp, 'frame-src', ref.psp_frame)) {
      return `la CSP bloque l’iframe du prestataire (${ref.psp_frame}) : la page de paiement serait cassée`;
    }
    // …et bloquer ce qu'elle ne charge pas.
    for (const payload of ['https://evil.example/collector.js', 'http://pay.novafact.example/x.js', 'https://cdn.attacker.test/a.js']) {
      if (cspAllows(csp, 'script-src', payload)) return `la CSP laisse charger ${payload} : une origine hors inventaire passe`;
    }
    return null;
  },

  // ── Étape 6 · Contrôles anti-abus ───────────────────────────────────────

  'capstone-anti-abuse': () => {
    // Le flux est fabriqué à chaque audit : identités et adresses tirées au
    // sort, donc impossible de coder la réponse en dur.
    const r = rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    interface Ev { at: number; journey: string; ip: string; account: string; label: string }
    const events: Ev[] = [];
    const journeys = ['signup', 'login', 'invoice-send'];
    let at = 0;

    // 300 clients légitimes : peu de requêtes, adresses distinctes.
    for (let i = 0; i < 300; i++) {
      const ip = `${10 + Math.floor(r() * 200)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}`;
      const account = `${word(r, 7)}@${word(r, 5)}.example`;
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        events.push({ at: at += 1 + Math.floor(r() * 30), journey: pick(r, journeys), ip, account, label: 'legitime' });
      }
    }
    // 8 bots et fraudeurs : rafales depuis une même adresse ou sur un même compte.
    for (let i = 0; i < 8; i++) {
      const ip = `${10 + Math.floor(r() * 200)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}`;
      const journey = pick(r, journeys);
      const fixedAccount = `${word(r, 6)}@${word(r, 5)}.example`;
      const sameAccount = r() < 0.5;
      for (let k = 0; k < 40; k++) {
        events.push({
          at: at += 1,
          journey,
          ip,
          account: sameAccount ? fixedAccount : `${word(r, 8)}@${word(r, 5)}.example`,
          label: 'abus',
        });
      }
    }
    events.sort((a, b) => a.at - b.at);

    const out = callModule(
      `${S6}/controls.mjs`,
      (mod, input) => `
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const mod = await import(${JSON.stringify(mod)});
const events = JSON.parse(readFileSync(fileURLToPath(${JSON.stringify(input)}), 'utf8'));
const decide = mod.decide ?? mod.default;
if (typeof decide !== 'function') { console.log(JSON.stringify({ __result__: { error: 'controls.mjs n’exporte pas decide()' } })); process.exit(0); }
const decisions = events.map((e) => { try { return String(decide({ at: e.at, journey: e.journey, ip: e.ip, account: e.account })); } catch (err) { return 'ERREUR:' + String(err && err.message); } });
console.log(JSON.stringify({ __result__: decisions }));
`,
      events.map((e) => ({ at: e.at, journey: e.journey, ip: e.ip, account: e.account })),
      45_000,
    );
    if ('err' in out) return out.err;
    const decisions = out.value as string[];
    if (!Array.isArray(decisions) || decisions.length !== events.length) {
      return `\`${S6}/controls.mjs\` doit exporter decide(event) et rendre une décision par événement`;
    }
    const crash = decisions.find((d) => d.startsWith('ERREUR:'));
    if (crash) return `les contrôles ont levé : ${crash.slice(7, 160)}`;
    const bad = decisions.find((d) => !['allow', 'challenge', 'block'].includes(d));
    if (bad !== undefined) return `« ${bad} » n’est pas une décision (allow, challenge, block)`;

    const abuse = events.filter((e) => e.label === 'abus');
    const legit = events.filter((e) => e.label === 'legitime');
    const blockedAbuse = abuse.filter((_, i) => decisions[events.indexOf(abuse[i])] !== 'allow').length;
    const hinderedLegit = legit.filter((e) => decisions[events.indexOf(e)] === 'block').length;
    const challengedLegit = legit.filter((e) => decisions[events.indexOf(e)] === 'challenge').length;

    const caught = blockedAbuse / abuse.length;
    const hurt = hinderedLegit / legit.length;
    const friction = challengedLegit / legit.length;
    if (caught < 0.8) {
      return `${Math.round(caught * 100)} % des requêtes abusives sont arrêtées (seuil 80 %) : les contrôles laissent passer la rafale`;
    }
    if (hurt > 0.02) {
      return `${Math.round(hurt * 100)} % des clients légitimes sont bloqués (seuil 2 %) : un contrôle qui bloque tout gagne d’un côté et perd de l’autre`;
    }
    if (friction > 0.2) {
      return `${Math.round(friction * 100)} % des clients légitimes reçoivent un défi (seuil 20 %) : la friction est le coût caché de l’anti-abus`;
    }
    return null;
  },

  // ── Étape 7 · Pipeline et supply chain ──────────────────────────────────

  'capstone-pipeline': () => {
    const untrusted = /\$\{\{\s*(github\.event\.|github\.head_ref|inputs\.|github\.actor\b)/;
    const wanted = ['ci.yml', 'release.yml'];
    const docs: Record<string, Doc> = {};
    for (const f of wanted) {
      const r = yaml(`${S7}/${f}`);
      if ('err' in r) return r.err;
      docs[f] = r.doc;
    }

    const allSteps = (doc: Doc) =>
      Object.entries((doc.jobs ?? {}) as Record<string, Doc>).flatMap(([jobId, job]) =>
        arr(job.steps).map((step) => ({ jobId, job, step })),
      );

    for (const f of wanted) {
      const doc = docs[f];
      const jobs = Object.entries((doc.jobs ?? {}) as Record<string, Doc>);
      if (!jobs.length) return `\`${S7}/${f}\` ne déclare aucun job`;
      const perms = JSON.stringify([doc.permissions, ...jobs.map(([, j]) => j.permissions)]);
      if (doc.permissions === undefined && !jobs.every(([, j]) => j.permissions !== undefined)) {
        return `${f} ne déclare pas de bloc permissions`;
      }
      if (perms.includes('write-all')) return `${f} accorde write-all`;
      if (jobs.some(([, j]) => j.secrets === 'inherit')) return `${f} transmet tous les secrets par « secrets: inherit »`;
      for (const { jobId, step } of allSteps(doc)) {
        const uses = str(step.uses);
        if (uses && !uses.startsWith('./') && !/@[0-9a-f]{40}$/.test(uses)) {
          return `${f} : ${uses} n’est pas épinglé à un SHA de 40 caractères`;
        }
        const script = str(step.run);
        if (script && untrusted.test(script)) {
          return `${f} (job ${jobId}) interpole une entrée non fiable dans un run`;
        }
        if (script && /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba)?sh\b/.test(script)) {
          return `${f} (job ${jobId}) exécute un script téléchargé sans vérifier son empreinte`;
        }
      }
    }

    const releaseText = JSON.stringify(docs['release.yml']);
    if (!/--provenance/.test(releaseText)) return 'release.yml publie sans attestation de provenance';
    if (!/"id-token"\s*:\s*"write"/.test(releaseText)) return 'release.yml n’a pas la permission id-token: write (publication de confiance OIDC)';
    if (/NPM_TOKEN/.test(releaseText)) return 'release.yml utilise encore un jeton npm de longue durée';

    // La CI doit continuer de passer sur une contribution légitime : les
    // commandes du workflow d'origine doivent survivre au durcissement.
    const origin = labText('novafact/.github/workflows/ci.yml') ?? '';
    const needed = uniq([...origin.matchAll(/npm\s+(ci|install|test|run\s+[\w:-]+)/g)].map((m) => m[1].replace(/^install$/, 'ci')));
    const ciText = JSON.stringify(docs['ci.yml']);
    const lost = needed.filter((c) => !ciText.includes(`npm ${c}`));
    if (lost.length) return `des étapes légitimes de la CI ont disparu du durcissement : npm ${lost.join(', npm ')}`;
    if (ciText.includes('npm install')) return 'ci.yml utilise encore « npm install » au lieu de « npm ci »';

    // Le SBOM : celui qui répondra le jour de l'incident, donc complet.
    const sbom = json(`${S7}/sbom.cdx.json`);
    if ('err' in sbom) return sbom.err;
    if (str(sbom.doc.bomFormat) !== 'CycloneDX') return 'le SBOM n’annonce pas le format CycloneDX';
    const spec = str(sbom.doc.specVersion);
    if (!/^1\.[4-9]$|^1\.\d\d/.test(spec)) return `la version de spécification du SBOM (${spec || 'absente'}) est antérieure à 1.4`;
    const lock = labText('novafact/package-lock.json');
    if (lock === null) return 'le lockfile de la fixture est introuvable : vérification impossible';
    const packages = JSON.parse(lock) as { packages?: Record<string, { version?: string }> };
    const expected = Object.entries(packages.packages ?? {})
      .filter(([name]) => name !== '')
      .map(([name, meta]) => `${name.replace(/^node_modules\//, '')}@${meta.version ?? ''}`);
    const components = new Set(arr(sbom.doc.components).map((c) => `${str(c.name)}@${str(c.version)}`));
    const missingComp = expected.filter((e) => !components.has(e));
    if (missingComp.length) return `le SBOM ne couvre pas tout le lockfile : ${few(missingComp)}`;
    return null;
  },

  // ── Étape 8 · IAM au moindre privilège ──────────────────────────────────

  'capstone-iam': () => {
    const ref = fixture<{ usage: { action: string; resource: string }[]; escalation: string[] }>('m20/iam-usage.json');
    if (!ref) return 'la fixture fixtures/m20/iam-usage.json est absente : vérification impossible';

    const dir = path.join(WORKSPACE, S8, 'policies');
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return missing(`${S8}/policies/`);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    if (!files.length) return `aucune politique dans \`workspace/${S8}/policies/\``;

    const statements: { file: string; st: Statement }[] = [];
    for (const f of files) {
      const r = json(`${S8}/policies/${f}`);
      if ('err' in r) return r.err;
      const list = statementsOf(r.doc);
      if (!list.length) return `${f} ne contient aucune déclaration (Statement)`;
      for (const st of list) statements.push({ file: f, st });
    }

    const allows = statements.filter((x) => (x.st.Effect ?? 'Allow') === 'Allow');
    const denies = statements.filter((x) => x.st.Effect === 'Deny');

    for (const { file, st } of allows) {
      if (strs(st.Action).includes('*')) return `${file} accorde toutes les actions (Action: "*")`;
      const resources = strs(st.Resource);
      if (!resources.length) return `${file} accorde une action sans Resource`;
      const writes = strs(st.Action).some((a) => !/(Get|List|Describe|Read|Head)/i.test(a));
      if (writes && resources.includes('*')) return `${file} accorde une action d’écriture sur toutes les ressources`;
    }

    const allowed = (action: string, resource: string) =>
      allows.some((x) => matchesAction(x.st, action) && matchesResource(x.st, resource)) &&
      !denies.some((x) => matchesAction(x.st, action) && matchesResource(x.st, resource));

    // L'application doit continuer de fonctionner.
    const broken = ref.usage.filter((u) => !allowed(u.action, u.resource));
    if (broken.length) {
      return `l’application n’a plus le droit de faire ce qu’elle fait : ${few(broken.map((u) => `${u.action} sur ${u.resource}`))}`;
    }
    // …et aucune action d'escalade ne doit subsister.
    const escalation = ref.escalation.filter((a) =>
      allows.some((x) => matchesAction(x.st, a) && (a !== 'iam:PassRole' || x.st.Condition === undefined)),
    );
    if (escalation.length) return `des actions d’escalade restent accordées : ${few(escalation)}`;

    const perimeter = json(`${S8}/perimeter.json`);
    if ('err' in perimeter) return perimeter.err;
    const raw = JSON.stringify(perimeter.doc);
    if (!/"Effect"\s*:\s*"Deny"/.test(raw)) return 'le périmètre de données ne contient aucun Deny : il ne rattrape rien';
    if (!/aws:(PrincipalOrgID|ResourceOrgID|PrincipalIsAWSService)/.test(raw)) {
      return 'le périmètre de données ne s’appuie sur aucune condition d’organisation (aws:PrincipalOrgID ou aws:ResourceOrgID)';
    }
    return null;
  },

  // ── Étape 10 · Cinq détections testées ──────────────────────────────────

  'capstone-detections': () => {
    const mitre = fixture<{ attack: Record<string, { name: string }> }>('m11/mitre.json');
    if (!mitre) return 'la fixture fixtures/m11/mitre.json est absente : vérification impossible';

    const rules = yaml(`${S10}/rules.yaml`);
    if ('err' in rules) return rules.err;
    const list = arr(rules.doc.rules);
    if (list.length < 5) return `${list.length} règles décrites : le capstone en demande cinq`;

    const SCENARIOS = ['bola-enumeration', 'credential-stuffing', 'ssrf-metadata', 'export-eleve', 'assistant-outil'];
    const seenScenarios = new Set<string>();
    const seenTechniques = new Set<string>();

    for (const rule of list) {
      const id = str(rule.id);
      if (!id) return 'une règle n’a pas d’identifiant';
      const technique = str(rule.attack).toUpperCase();
      if (!mitre.attack[technique]) return `la règle ${id} cite ${technique || '(rien)'}, qui n’est pas une technique ATT&CK des correspondances embarquées`;
      if (seenTechniques.has(technique)) return `deux règles couvrent ${technique} : cinq règles doivent couvrir cinq techniques distinctes`;
      seenTechniques.add(technique);

      const scenario = str(rule.scenario);
      if (!SCENARIOS.includes(scenario)) return `« ${scenario || '(vide)'} » n’est pas un scénario du capstone (${SCENARIOS.join(', ')})`;
      if (seenScenarios.has(scenario)) return `le scénario ${scenario} est couvert deux fois`;
      seenScenarios.add(scenario);

      const modRel = `${S10}/${str(rule.module)}`;
      if (!fs.existsSync(path.join(WORKSPACE, modRel))) return `la règle ${id} désigne le module « ${str(rule.module) || '(vide)'} », qui n’existe pas`;

      // Le corpus : avant la détonation elle se tait, pendant elle lève, après
      // le retour arrière elle se tait de nouveau. Identités tirées au sort.
      const r = rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      const corpus = buildCorpus(scenario, r);
      const out = callModule(
        modRel,
        (mod, input) => `
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const mod = await import(${JSON.stringify(mod)});
const events = JSON.parse(readFileSync(fileURLToPath(${JSON.stringify(input)}), 'utf8'));
const match = mod.match ?? mod.default;
if (typeof match !== 'function') { console.log(JSON.stringify({ __result__: { error: 'le module n’exporte pas match()' } })); process.exit(0); }
const hits = events.map((e) => { try { return match(e) === true; } catch (err) { return 'ERREUR:' + String(err && err.message); } });
console.log(JSON.stringify({ __result__: hits }));
`,
        corpus.map((c) => c.event),
      );
      if ('err' in out) return out.err;
      const hits = out.value as (boolean | string)[];
      if (!Array.isArray(hits) || hits.length !== corpus.length) {
        return `le module de la règle ${id} doit exporter match(event) et répondre pour chaque événement`;
      }
      const crash = hits.find((h) => typeof h === 'string');
      if (crash) return `la règle ${id} a levé : ${String(crash).slice(7, 160)}`;

      const tp = corpus.filter((c, i) => c.malicious && hits[i] === true).length;
      const fn = corpus.filter((c, i) => c.malicious && hits[i] !== true).length;
      const fp = corpus.filter((c, i) => !c.malicious && hits[i] === true).length;
      if (fn) return `la règle ${id} rate ${fn} événement(s) de la détonation : le rappel doit être de 1`;
      const precision = tp / (tp + fp || 1);
      if (precision < 0.9) {
        return `la règle ${id} lève sur ${fp} événement(s) de trafic normal (précision ${Math.round(precision * 100)} %, seuil 90 %)`;
      }
    }
    return null;
  },

  // ── Étape 11 · Roadmap à 12 mois ────────────────────────────────────────

  'capstone-roadmap': () => {
    const samm = fixture<{ practices: string[]; capacity_days_per_quarter: number }>('m20/samm.json');
    if (!samm) return 'la fixture fixtures/m20/samm.json est absente : vérification impossible';

    const maturity = yaml(`${S11}/maturity.yaml`);
    if ('err' in maturity) return maturity.err;
    const scored = new Map<string, number>();
    for (const p of arr(maturity.doc.practices)) {
      const id = str(p.id);
      if (!samm.practices.includes(id)) return `« ${id || '(vide)'} » n’est pas une pratique SAMM v2`;
      const score = num(p.score);
      if (!Number.isFinite(score) || score < 0 || score > 3) return `la note de ${id} n’est pas comprise entre 0 et 3`;
      if (str(p.evidence).length < 10) return `la note de ${id} n’est appuyée sur aucune observation`;
      scored.set(id, score);
    }
    const unscored = samm.practices.filter((p) => !scored.has(p));
    if (unscored.length) return `des pratiques ne sont pas évaluées : ${few(unscored)}`;

    const roadmap = yaml(`${S11}/roadmap.yaml`);
    if ('err' in roadmap) return roadmap.err;
    const quarters = arr(roadmap.doc.quarters);
    if (quarters.length !== 4) return `la feuille de route couvre ${quarters.length} trimestres au lieu de 4`;

    const addressed = new Set<string>();
    const improved = new Set<string>();
    for (const q of quarters) {
      const label = str(q.q) || '(sans nom)';
      const activities = arr(q.activities);
      if (!activities.length) return `le trimestre ${label} n’a aucune activité`;
      let effort = 0;
      for (const a of activities) {
        const practice = str(a.practice);
        if (!samm.practices.includes(practice)) return `l’activité « ${str(a.name) || '?'} » vise « ${practice || '(rien)'} », qui n’est pas une pratique SAMM`;
        improved.add(practice);
        const days = num(a.effort_days);
        if (!Number.isFinite(days) || days <= 0) return `l’activité « ${str(a.name) || '?'} » n’est pas chiffrée en jours`;
        effort += days;
        for (const c of strs(a.addresses)) addressed.add(c.toUpperCase());
      }
      if (effort > samm.capacity_days_per_quarter) {
        return `le trimestre ${label} demande ${effort} jours pour une capacité de ${samm.capacity_days_per_quarter} : le plan n’est pas tenable`;
      }
    }

    // Cohérence avec l'étape 4 : ce que la revue a trouvé doit être adressé.
    const review = wsYaml<Doc>(`${S4}/review.yaml`);
    if (review === null || 'error' in review) {
      return `l’étape 4 n’est pas faite : \`workspace/${S4}/review.yaml\` est absent ou illisible`;
    }
    const found = uniq(
      arr((review.value as Doc).findings)
        .filter((f) => str(f.verdict) === 'bloquant')
        .map((f) => str(f.cwe).toUpperCase())
        .filter(Boolean),
    );
    if (!found.length) return 'la revue de l’étape 4 ne contient aucun constat bloquant à adresser';
    const ignored = found.filter((c) => !addressed.has(c));
    if (ignored.length) {
      return `la revue a trouvé ${few(ignored)} et aucune activité du plan ne l’adresse : un plan qui ignore ce que la revue vient de trouver n’est pas un plan`;
    }

    const weak = [...scored.entries()].filter(([, s]) => s <= 1).map(([p]) => p);
    const untouched = weak.filter((p) => !improved.has(p));
    if (untouched.length) return `des pratiques notées 0 ou 1 ne sont reprises par aucune activité : ${few(untouched)}`;
    return null;
  },

  // ── Étape 12 · Adoption ─────────────────────────────────────────────────

  'capstone-adoption': () => {
    const wfDir = path.join(LAB_ROOT, 'novafact/.github/workflows');
    if (!fs.existsSync(wfDir)) return 'le dépôt fixture novafact/ est absent : vérification impossible';
    const workflows = fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)).sort();

    const doc = yaml(`${S12}/adoption.yaml`);
    if ('err' in doc) return doc.err;

    // Les portes existent vraiment dans la CI.
    const gates = arr(doc.doc.gates);
    if (gates.length < 3) return `${gates.length} porte(s) de contrôle décrite(s) : il en faut au moins 3`;
    for (const g of gates) {
      const file = str(g.workflow);
      if (!workflows.includes(file)) return `la porte « ${str(g.name) || '?'} » cite le workflow « ${file || '(vide)'} », qui n’existe pas dans novafact/.github/workflows`;
      const raw = fs.readFileSync(path.join(wfDir, file), 'utf8');
      const jobs = [...(raw.split(/^jobs:\s*$/m)[1] ?? '').matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)].map((m) => m[1]);
      const job = str(g.job);
      if (!jobs.includes(job)) return `la porte « ${str(g.name) || '?'} » cite le job « ${job || '(vide)'} », absent de ${file}`;
      if (g.blocking !== true && g.blocking !== false) return `la porte « ${str(g.name) || '?'} » ne dit pas si elle bloque la fusion`;
    }
    if (!gates.some((g) => g.blocking === true)) return 'aucune porte ne bloque : une porte qui ne bloque jamais est un tableau de bord';

    // Les SLA sont mesurables et ordonnés.
    const SEVERITIES = ['critique', 'elevee', 'moyenne', 'faible'];
    const slas = new Map<string, number>();
    for (const s of arr(doc.doc.slas)) {
      const sev = str(s.severity).toLowerCase();
      if (!SEVERITIES.includes(sev)) return `« ${str(s.severity) || '(vide)'} » n’est pas une sévérité (${SEVERITIES.join(', ')})`;
      const days = num(s.days);
      if (!Number.isFinite(days) || days <= 0) return `le SLA de la sévérité ${sev} n’est pas un nombre de jours`;
      slas.set(sev, days);
    }
    const holes = SEVERITIES.filter((s) => !slas.has(s));
    if (holes.length) return `des sévérités n’ont pas de SLA : ${holes.join(', ')}`;
    for (let i = 1; i < SEVERITIES.length; i++) {
      if (slas.get(SEVERITIES[i])! <= slas.get(SEVERITIES[i - 1])!) {
        return `le SLA « ${SEVERITIES[i]} » n’est pas plus long que « ${SEVERITIES[i - 1]} » : le classement ne sert à rien`;
      }
    }

    // Les chemins sensibles sont routés vers les bonnes personnes.
    const routing = arr(doc.doc.routing);
    const routed = new Map<string, string>();
    for (const r of routing) {
      const p = str(r.path);
      if (!p || !labExists(p)) return `le chemin routé « ${p || '(vide)'} » n’existe pas dans le dépôt`;
      const owner = str(r.owner);
      if (!/^@[\w-]+\/[\w-]+$/.test(owner)) return `« ${owner || '(vide)'} » n’est pas une équipe de la forge (@organisation/équipe)`;
      routed.set(p, owner);
    }
    const mustRoute = [
      ...workflows.map((f) => `novafact/.github/workflows/${f}`),
      'novafact/.github/CODEOWNERS',
      'novafact/.npmrc',
      'novafact/package-lock.json',
    ].filter((p) => labExists(p));
    const unrouted = mustRoute.filter((p) => !routed.has(p));
    if (unrouted.length) return `des chemins sensibles ne sont routés vers personne : ${few(unrouted)}`;

    const champions = arr(doc.doc.champions);
    if (champions.length < 2) return `${champions.length} champion(s) désigné(s) : le réseau ne tient pas à une personne`;
    for (const c of champions) {
      if (!str(c.team) || !str(c.person)) return 'un champion n’est rattaché à aucune équipe, ou n’a pas de nom';
      if (!Number.isFinite(num(c.time_percent)) || num(c.time_percent) <= 0) {
        return `le champion de « ${str(c.team) || '?'} » n’a pas de temps alloué : un champion sans temps est un titre`;
      }
    }
    return null;
  },
};

// ── Corpus de détection ─────────────────────────────────────────────────────
//
// Trois phases : avant la détonation (trafic normal), pendant, après retour
// arrière (trafic normal à nouveau). Les identités changent à chaque audit.

interface CorpusEntry { event: Record<string, unknown>; malicious: boolean }

function buildCorpus(scenario: string, r: () => number): CorpusEntry[] {
  const out: CorpusEntry[] = [];
  const ip = () => `${10 + Math.floor(r() * 200)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}`;
  const actor = () => `${word(r, 7)}@${word(r, 5)}.example`;
  let at = 0;
  const push = (event: Record<string, unknown>, malicious: boolean) =>
    out.push({ event: { at: at += 1 + Math.floor(r() * 5), ...event }, malicious });

  const normal = (n: number) => {
    for (let i = 0; i < n; i++) {
      const who = actor();
      push({ route: 'GET /api/invoices', actor: who, ip: ip(), status: 200, tenant: word(r, 5) }, false);
      push({ route: 'POST /api/auth/login', actor: who, ip: ip(), status: 200, tenant: word(r, 5) }, false);
      push({ route: 'GET /api/invoices/:id', actor: who, ip: ip(), status: 200, tenant: word(r, 5), owner_tenant: 'self' }, false);
      push({ route: 'POST /api/webhooks/test', actor: who, ip: ip(), status: 200, host: `${word(r, 6)}.example`, tenant: word(r, 5) }, false);
      push({ route: 'GET /api/export', actor: who, ip: ip(), status: 403, role: 'user', tenant: word(r, 5) }, false);
      push({ route: 'POST /api/assistant', actor: who, ip: ip(), status: 200, tool: null, tool_origin: null, tenant: word(r, 5) }, false);
    }
  };

  normal(4);
  const who = actor();
  const source = ip();
  switch (scenario) {
    case 'bola-enumeration':
      for (let i = 0; i < 25; i++) {
        push({ route: 'GET /api/invoices/:id', actor: who, ip: source, status: i % 4 === 0 ? 200 : 404, tenant: 'acme', owner_tenant: 'other' }, true);
      }
      break;
    case 'credential-stuffing':
      for (let i = 0; i < 30; i++) {
        push({ route: 'POST /api/auth/login', actor: actor(), ip: source, status: i === 29 ? 200 : 401, tenant: null }, true);
      }
      break;
    case 'ssrf-metadata':
      for (const host of ['169.254.169.254', '127.0.0.1', '169.254.169.254', 'metadata.google.internal']) {
        push({ route: 'POST /api/webhooks/test', actor: who, ip: source, status: 200, host, tenant: 'acme' }, true);
      }
      break;
    case 'export-eleve':
      for (let i = 0; i < 6; i++) {
        push({ route: 'GET /api/export', actor: who, ip: source, status: 200, role: 'user', tenant: 'acme' }, true);
      }
      break;
    case 'assistant-outil':
      for (let i = 0; i < 5; i++) {
        push({ route: 'POST /api/assistant', actor: who, ip: source, status: 200, tool: 'send_email', tool_origin: 'document', tenant: 'acme' }, true);
      }
      break;
    default:
      break;
  }
  normal(4);
  return out;
}
