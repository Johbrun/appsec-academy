// Vérifications des challenges M18 · Surveillance, logging & SIEM.
//
// Tous les challenges de ce module sont de type « artifact » : l'apprenant
// **produit** un fichier dans `workspace/`, et c'est ce fichier qui est jugé.
// Aucun cluster Elastic n'est nécessaire — le lab embarque des corpus
// étiquetés et un moteur de requête (server/audit/detect.ts), et tout est
// déterministe.
//
// Quatre règles tiennent ce fichier :
//
//   1. **Un livrable absent, vide ou illisible ne passe jamais au vert.** Un
//      fichier qu'on n'arrive pas à lire ne contient aucun défaut : sans
//      garde-fou il passerait par accident. On distingue donc toujours
//      « absent », « illisible » et « lu mais insuffisant ».
//
//   2. **On dit les chiffres.** Une règle notée en précision et en rappel
//      reçoit sa note et le nom des cas qu'elle rate ou qu'elle attrape à
//      tort. « Ce n'est pas encore ça » n'apprend rien ; « 9 vrais positifs
//      sur 12, et 3 faux positifs — la règle attrape le test de charge »
//      indique la prochaine modification à faire.
//
//   3. **Le codage en dur est refusé.** Les règles sont rejouées sur un second
//      corpus, tiré des mêmes générateurs avec une autre graine : une règle
//      qui énumère les adresses des douze attaquants du premier corpus ne
//      trouve rien dans le second. S'ajoute le garde-fou statique de
//      `hardcodingError`, qui refuse les champs d'identifiant et l'horodatage.
//
//   4. **Ce qui relève du jugement n'est pas noté** — et les énoncés le
//      disent. La prose d'une fiche de stratégie n'est pas évaluée ; ses
//      rubriques, l'identifiant de technique qu'elle cite et la requête de sa
//      recette de validation le sont.

import { load as loadYaml } from 'js-yaml';
import {
  evaluate, fxJson, fxList, fxNdjson, fxText, fxYaml, hardcodingError, loadCorpus, maliciousCount,
  parseDuration, parseRule, score, scoreSentence,
  type Corpus, type EcsEvent, type Rule,
} from './detect.ts';
import { missing, wsText, wsYaml } from './workspace.ts';
import type { Check } from './m14.ts';

// ── Outils de lecture ───────────────────────────────────────────────────────

type Doc = Record<string, unknown>;

const obj = (v: unknown): Doc | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): string[] => arr(v).map(String);

const lines = (...xs: (string | null)[]) => {
  const kept = xs.filter(Boolean) as string[];
  return kept.length ? kept.join(' · ') : null;
};

/** Les trois états d'un livrable YAML : absent, illisible, lu. */
type Loaded<T> = { ok: true; value: T } | { ok: false; error: string };

function loadYamlDoc<T = unknown>(rel: string): Loaded<T> {
  const doc = wsYaml<T>(rel);
  if (doc === null) return { ok: false, error: missing(rel) };
  if ('error' in doc) return { ok: false, error: `\`workspace/${rel}\` ${doc.error}` };
  const value = doc.value;
  if (value === null || value === undefined || (obj(value) && Object.keys(obj(value)!).length === 0)) {
    return { ok: false, error: `\`workspace/${rel}\` est vide` };
  }
  return { ok: true, value };
}

function loadNdjson(rel: string): Loaded<EcsEvent[]> {
  const raw = wsText(rel);
  if (raw === null) return { ok: false, error: missing(rel) };
  const rows: EcsEvent[] = [];
  for (const [i, line] of raw.split('\n').entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!obj(parsed)) return { ok: false, error: `\`workspace/${rel}\` ligne ${i + 1} : ce n’est pas un objet JSON` };
      rows.push(parsed as EcsEvent);
    } catch (err) {
      return {
        ok: false,
        error: `\`workspace/${rel}\` ligne ${i + 1} n’est pas du JSON valide (${(err as Error).message.split('\n')[0]})`,
      };
    }
  }
  if (!rows.length) return { ok: false, error: `\`workspace/${rel}\` ne contient aucune ligne` };
  return { ok: true, value: rows };
}

// ── Chemins pointés ─────────────────────────────────────────────────────────

const getPath = (root: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((cur, key) => (obj(cur) ? obj(cur)![key] : undefined), root);

function setPath(root: Doc, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur = root;
  for (const key of parts.slice(0, -1)) {
    if (!obj(cur[key])) cur[key] = {};
    cur = cur[key] as Doc;
  }
  cur[parts[parts.length - 1]] = value;
}

function deletePath(root: Doc, path: string): void {
  const parts = path.split('.');
  let cur: Doc | null = root;
  for (const key of parts.slice(0, -1)) {
    cur = obj(cur[key]);
    if (!cur) return;
  }
  delete cur[parts[parts.length - 1]];
}

/** Toutes les feuilles d'un objet, sous forme chemin → valeur. */
function leaves(root: unknown, prefix = '', out: Map<string, string> = new Map()): Map<string, string> {
  if (Array.isArray(root)) {
    root.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
    return out;
  }
  const o = obj(root);
  if (!o) {
    out.set(prefix, JSON.stringify(root));
    return out;
  }
  for (const [k, v] of Object.entries(o)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ── Lecture d'une règle écrite par l'apprenant ──────────────────────────────

function ruleOf(rel: string, corpora: Corpus[]): Loaded<Rule> {
  const doc = loadYamlDoc(rel);
  if (!doc.ok) return doc;
  const parsed = parseRule(doc.value, `workspace/${rel}`);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const hard = hardcodingError(parsed.value, corpora);
  if (hard) return { ok: false, error: hard };
  return { ok: true, value: parsed.value };
}

/** Note une règle sur un corpus, et exige la perfection. */
function perfect(rule: Rule, corpus: Corpus, where: string): string | null {
  const s = score(evaluate(rule, corpus.events), corpus);
  const total = maliciousCount(corpus);
  if (s.tp.length === total && s.fp.length === 0) return null;
  return `sur ${where} : ${scoreSentence(s, total)}`;
}

/** Note une règle sur un corpus, et exige des cibles. */
function atLeast(rule: Rule, corpus: Corpus, minP: number, minR: number, where: string): string | null {
  const s = score(evaluate(rule, corpus.events), corpus);
  const total = maliciousCount(corpus);
  if (s.precision >= minP - 1e-9 && s.recall >= minR - 1e-9) return null;
  return `sur ${where} : ${scoreSentence(s, total)} — les cibles sont ${Math.round(minP * 100)} % de précision et ${Math.round(minR * 100)} % de rappel`;
}

// ── Corpus, chargés à la demande ────────────────────────────────────────────

const cache = new Map<string, Corpus>();
const corpus = (name: string): Corpus => {
  const hit = cache.get(name);
  if (hit) return hit;
  const loaded = loadCorpus(name);
  cache.set(name, loaded);
  return loaded;
};

const ruleFile = (id: string) => fxYaml<Doc>(`rules/${id}.yaml`);
const RULE_IDS = () => fxList('rules').filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''));

// ── 1 · Le vocabulaire imposé ───────────────────────────────────────────────

/** Ce que chaque scénario doit devenir, dans le vocabulaire d'OWASP. */
const VOCABULARY_TRUTH: Record<string, string> = {
  S1: 'authn_login_fail',
  S2: 'authn_login_lock',
  S3: 'authz_fail',
  S4: 'malicious_direct_reference',
  S5: 'excess_rate_limit_exceeded',
  S6: 'privilege_permissions_changed',
  S7: 'sensitive_read',
  S8: 'user_created',
};

/** Le socle obligatoire : sans lui, aucune règle ne peut s'appuyer sur la ligne. */
const CORE_FIELDS = ['@timestamp', 'event.action', 'event.outcome', 'user.name', 'source.ip'];

const owaspVocabulary = (): string[] =>
  (fxText('vocabulary/owasp-events.txt') ?? '')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

// ── 2 · Caviardage ──────────────────────────────────────────────────────────

interface Redaction {
  drop: string[];
  mask: { field: string; keep: number }[];
}

function parseRedaction(value: unknown): Loaded<Redaction> {
  const o = obj(value);
  if (!o) return { ok: false, error: '`workspace/logging/redaction.yaml` n’est pas un objet YAML' };
  const drop = list(o.drop).map((s) => s.trim()).filter(Boolean);
  const mask: Redaction['mask'] = [];
  for (const [i, raw] of arr(o.mask).entries()) {
    const m = obj(raw);
    if (!m || !str(m.field)) return { ok: false, error: `mask[${i}] n’a pas de champ \`field\`` };
    const keep = m.keep === undefined ? 0 : Number(m.keep);
    if (!Number.isInteger(keep) || keep < 0 || keep > 4) {
      return { ok: false, error: `mask[${i}] : \`keep\` doit être un entier entre 0 et 4 — en garder davantage ne caviarde plus rien` };
    }
    mask.push({ field: str(m.field), keep });
  }
  if (!drop.length && !mask.length) {
    return { ok: false, error: '`workspace/logging/redaction.yaml` ne déclare ni `drop` ni `mask` : rien n’est caviardé' };
  }
  return { ok: true, value: { drop, mask } };
}

function applyRedaction(events: EcsEvent[], rules: Redaction): EcsEvent[] {
  return events.map((ev) => {
    const out = clone(ev) as Doc;
    for (const path of rules.drop) deletePath(out, path);
    for (const { field, keep } of rules.mask) {
      const value = getPath(out, field);
      if (value === undefined || value === null) continue;
      const text = String(value);
      setPath(out, field, keep > 0 ? `[caviardé]${text.slice(-keep)}` : '[caviardé]');
    }
    return out as EcsEvent;
  });
}

// ── 3 · Normalisation des champs ────────────────────────────────────────────

interface Mapping {
  to: string;
  from?: string;
  const?: unknown;
  transform?: 'uppercase' | 'lowercase';
  values?: Record<string, unknown>;
}

function parseMapping(value: unknown): Loaded<Mapping[]> {
  const o = obj(value);
  const raw = arr(o?.map ?? value);
  if (!raw.length) return { ok: false, error: '`workspace/logging/field-mapping.yaml` ne déclare aucune correspondance sous `map`' };
  const out: Mapping[] = [];
  for (const [i, item] of raw.entries()) {
    const m = obj(item);
    if (!m || !str(m.to)) return { ok: false, error: `map[${i}] n’a pas de champ \`to\`` };
    if (!str(m.from) && m.const === undefined) {
      return { ok: false, error: `map[${i}] (${str(m.to)}) n’a ni \`from\` ni \`const\`` };
    }
    const transform = str(m.transform);
    if (transform && transform !== 'uppercase' && transform !== 'lowercase') {
      return { ok: false, error: `map[${i}] : transformation inconnue « ${transform} » — uppercase ou lowercase` };
    }
    out.push({
      to: str(m.to),
      from: str(m.from) || undefined,
      const: m.const,
      transform: (transform || undefined) as Mapping['transform'],
      values: obj(m.values) ? (obj(m.values) as Record<string, unknown>) : undefined,
    });
  }
  return { ok: true, value: out };
}

function applyMapping(rows: EcsEvent[], map: Mapping[]): EcsEvent[] {
  return rows.map((row) => {
    const out: Doc = { _case: row._case };
    for (const m of map) {
      let value: unknown = m.from !== undefined ? getPath(row, m.from) : m.const;
      if (value === undefined || value === null) continue;
      if (m.values) {
        const hit = m.values[String(value)];
        if (hit !== undefined) value = hit;
      }
      if (m.transform === 'uppercase') value = String(value).toUpperCase();
      if (m.transform === 'lowercase') value = String(value).toLowerCase();
      setPath(out, m.to, value);
    }
    return out as EcsEvent;
  });
}

// ── 4 · Lint du schéma ──────────────────────────────────────────────────────

const ECS_KIND = ['alert', 'event', 'metric', 'state', 'signal', 'pipeline_error'];
const ECS_CATEGORY = ['authentication', 'authorization', 'configuration', 'database', 'file', 'host',
  'iam', 'intrusion_detection', 'malware', 'network', 'package', 'process', 'registry', 'session',
  'threat', 'vulnerability', 'web', 'api'];
const ECS_TYPE = ['access', 'admin', 'allowed', 'change', 'connection', 'creation', 'deletion',
  'denied', 'end', 'error', 'indicator', 'info', 'installation', 'protocol', 'start', 'user'];
const ECS_OUTCOME = ['success', 'failure', 'unknown'];
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];

/** Le lint sémantique : énumérations fermées, puis contraintes croisées. */
function lintEvent(ev: EcsEvent): string[] {
  const bad: string[] = [];
  const id = String(getPath(ev, 'event.id') ?? '?');
  const say = (why: string) => bad.push(`${id} : ${why}`);

  const kind = getPath(ev, 'event.kind');
  if (!ECS_KIND.includes(String(kind))) say(`event.kind « ${String(kind)} » est hors énumération`);
  const categories = arr(getPath(ev, 'event.category')).map(String);
  if (!categories.length) say('event.category est absent');
  for (const c of categories) if (!ECS_CATEGORY.includes(c)) say(`event.category « ${c} » est hors énumération`);
  const types = arr(getPath(ev, 'event.type')).map(String);
  if (!types.length) say('event.type est absent');
  for (const t of types) if (!ECS_TYPE.includes(t)) say(`event.type « ${t} » est hors énumération`);
  const outcome = getPath(ev, 'event.outcome');

  if (categories.includes('authentication')) {
    if (outcome === undefined) say('catégorie authentication sans event.outcome');
    for (const t of types) {
      if (!['start', 'end', 'info'].includes(t)) {
        say(`catégorie authentication avec event.type « ${t} » — seuls start, end et info ont un sens ici`);
      }
    }
  }
  if (outcome !== undefined && !ECS_OUTCOME.includes(String(outcome))) {
    say(`event.outcome « ${String(outcome)} » est hors énumération`);
  }
  if (categories.includes('web')) {
    for (const f of ['url.path', 'http.request.method', 'http.response.status_code']) {
      if (getPath(ev, f) === undefined) say(`catégorie web sans ${f}`);
    }
  }
  const method = getPath(ev, 'http.request.method');
  if (method !== undefined && !HTTP_METHODS.includes(String(method))) {
    say(`http.request.method « ${String(method)} » n’est pas une méthode HTTP`);
  }
  if (String(kind) === 'alert' && getPath(ev, 'rule.name') === undefined) {
    say('event.kind alert sans rule.name — personne ne saura quelle règle a levé');
  }
  const status = Number(getPath(ev, 'http.response.status_code'));
  if (Number.isFinite(status) && status >= 400 && String(outcome) === 'success') {
    say(`statut ${status} et event.outcome success : les deux se contredisent`);
  }
  if (Number.isNaN(Date.parse(String(ev['@timestamp'] ?? '')))) say('@timestamp ne se lit pas');
  return bad;
}

// ── 12 · L'environnement simulé de l'atomique ───────────────────────────────

interface AtomicStep {
  action: string;
  [key: string]: unknown;
}

interface AtomicRun {
  accounts: Record<string, string>;
  events: EcsEvent[];
  /** Les bornes d'indice de chaque phase dans `events`. */
  phases: { setup: number; detonation: number; rollback: number };
}

const STEP_ACTIONS = ['create_account', 'delete_account', 'login', 'advance'];

function expand(steps: unknown, at: string): Loaded<AtomicStep[]> {
  const out: AtomicStep[] = [];
  for (const [i, raw] of arr(steps).entries()) {
    const s = obj(raw);
    if (!s) return { ok: false, error: `${at}[${i}] n’est pas une étape` };
    const action = str(s.action);
    if (!STEP_ACTIONS.includes(action)) {
      return { ok: false, error: `${at}[${i}] : action inconnue « ${action || '(absente)'} » — ${STEP_ACTIONS.join(', ')}` };
    }
    const repeat = s.repeat === undefined ? 1 : Number(s.repeat);
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 200) {
      return { ok: false, error: `${at}[${i}] : \`repeat\` doit être un entier entre 1 et 200` };
    }
    for (let k = 0; k < repeat; k += 1) {
      const step: AtomicStep = { action };
      for (const [key, value] of Object.entries(s)) {
        if (key === 'repeat') continue;
        step[key] = typeof value === 'string' ? value.replace(/\{\{\s*i\s*\}\}/g, String(k)) : value;
      }
      out.push(step);
    }
  }
  if (out.length > 400) return { ok: false, error: `${at} produit ${out.length} étapes — 400 au maximum` };
  return { ok: true, value: out };
}

function runAtomic(setup: AtomicStep[], detonation: AtomicStep[], rollback: AtomicStep[], seed: Record<string, string>): AtomicRun {
  const accounts = { ...seed };
  const events: EcsEvent[] = [];
  let clock = Date.parse('2026-06-01T09:00:00.000Z');
  let n = 0;

  const play = (steps: AtomicStep[]) => {
    for (const step of steps) {
      const advance = parseDuration(step.advance ?? '5s') ?? 5000;
      switch (step.action) {
        case 'create_account':
          accounts[str(step.email)] = str(step.password);
          break;
        case 'delete_account':
          delete accounts[str(step.email)];
          break;
        case 'login': {
          const email = str(step.email);
          const success = accounts[email] !== undefined && accounts[email] === str(step.password);
          n += 1;
          events.push({
            '@timestamp': new Date(clock).toISOString(),
            event: {
              id: `at${String(n).padStart(4, '0')}`, kind: 'event', category: ['authentication'],
              type: [success ? 'start' : 'info'],
              action: success ? 'authn_login_success' : 'authn_login_fail',
              outcome: success ? 'success' : 'failure',
            },
            user: { name: email },
            source: { ip: str(step.source_ip) || '198.51.100.1' },
            http: { request: { method: 'POST' }, response: { status_code: success ? 200 : 401 } },
            url: { path: '/api/auth/login' },
            _case: 'atomique',
          });
          break;
        }
        default: break;
      }
      clock += advance;
    }
  };

  play(setup);
  const afterSetup = events.length;
  play(detonation);
  const afterDetonation = events.length;
  play(rollback);
  return { accounts, events, phases: { setup: afterSetup, detonation: afterDetonation, rollback: events.length } };
}

// ── 13 · Points de détection AppSensor ──────────────────────────────────────

const APPSENSOR_CASES: Record<string, string> = {
  AE1: 'hostile-ae1',
  ACE3: 'hostile-ace3',
  RE2: 'hostile-re2',
  SE5: 'hostile-se5',
  HT2: 'hostile-ht2',
  IE5: 'hostile-ie5',
};

// ── 15 · Réponse graduée ────────────────────────────────────────────────────

const STAGES = ['trace', 'alerte', 'ralentissement', 'verrouillage'];

// ── 17 · Couverture ─────────────────────────────────────────────────────────

interface Technique { id: string; name: string; deprecated: boolean }

const techniques = (): Technique[] =>
  (fxJson<{ techniques: Technique[] }>('coverage/attack.json')?.techniques ?? []);

const scenarioFiles = () => fxList('coverage/scenarios').filter((f) => f.endsWith('.ndjson'));
const scenarioId = (file: string) => file.replace(/\.ndjson$/, '');

/** Les règles que chaque scénario fait réellement lever. */
function replayCoverage(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const rules = RULE_IDS()
    .map((id) => ({ id, parsed: parseRule(ruleFile(id)?.query, id) }))
    .filter((r) => r.parsed.ok) as { id: string; parsed: { ok: true; value: Rule } }[];
  for (const file of scenarioFiles()) {
    const events = fxNdjson(`coverage/scenarios/${file}`);
    const fired = rules.filter((r) => evaluate(r.parsed.value, events).length > 0).map((r) => r.id);
    out.set(scenarioId(file), fired.sort());
  }
  return out;
}

// ── 18 · Chronologie de l'incident ──────────────────────────────────────────

/**
 * La vérité terrain de l'incident : les quatorze lignes qui en font partie,
 * dans l'ordre. Produite par `fixtures/m18/_gen/generate.mjs`, qui l'imprime à
 * la fin de son exécution. Elle vit ici et non dans les fixtures, pour que la
 * réponse ne soit pas à côté de la question.
 */
const INCIDENT_TRUTH = [
  'l00300', 'l00302', 'l00307', 'l00312', 'l00321', 'l00334', 'l00341',
  'l00342', 'l00347', 'l00354', 'l00363', 'l00370', 'l00374', 'l00377',
];

// ── Les vérifications ───────────────────────────────────────────────────────

export const m18Checks: Record<string, Check> = {
  // ── Journaliser ───────────────────────────────────────────────────────────

  'logging-vocabulary': () => {
    const rel = 'logging/vocabulary.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const entries = arr(obj(doc.value)?.events);
    if (!entries.length) return `\`workspace/${rel}\` ne déclare aucun événement sous \`events\``;

    const vocabulary = new Set(owaspVocabulary());
    const seen = new Set<string>();
    const bad: string[] = [];
    for (const raw of entries) {
      const e = obj(raw);
      if (!e) { bad.push('une entrée de `events` n’est pas un objet'); continue; }
      const scenario = str(e.scenario);
      if (!(scenario in VOCABULARY_TRUTH)) {
        bad.push(`le scénario « ${scenario || '(sans nom)'} » n’existe pas dans le corpus`);
        continue;
      }
      seen.add(scenario);
      const name = str(e.event);
      if (!vocabulary.has(name)) {
        bad.push(`${scenario} : « ${name || '(absent)'} » n’est pas dans le vocabulaire d’OWASP (fixtures/m18/vocabulary/owasp-events.txt)`);
      } else if (name !== VOCABULARY_TRUTH[scenario]) {
        bad.push(`${scenario} : « ${name} » ne décrit pas ce scénario`);
      }
      const fields = new Set(list(e.required_fields));
      const lacking = CORE_FIELDS.filter((f) => !fields.has(f));
      if (lacking.length) bad.push(`${scenario} : il manque ${lacking.join(', ')} dans required_fields`);
    }
    const forgotten = Object.keys(VOCABULARY_TRUTH).filter((s) => !seen.has(s));
    if (forgotten.length) bad.push(`aucune entrée pour ${forgotten.join(', ')}`);
    return bad.length ? bad.slice(0, 5).join(' · ') : null;
  },

  'never-log': () => {
    const rel = 'logging/redaction.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const parsed = parseRedaction(doc.value);
    if (!parsed.ok) return parsed.error;

    const c = corpus('redaction');
    const redacted = applyRedaction(c.events, parsed.value);
    const bad: string[] = [];

    const haystack = redacted.map((ev) => JSON.stringify(ev)).join('\n');
    const secrets = fxJson<{ literals: string[]; patterns: { name: string; regex: string }[] }>('redaction/secrets.json');
    const leaked = (secrets?.literals ?? []).filter((s) => haystack.includes(s));
    if (leaked.length) {
      bad.push(`${leaked.length} secret(s) subsistent dans le corpus caviardé, par exemple « ${leaked[0].slice(0, 12)}… »`);
    }
    for (const p of secrets?.patterns ?? []) {
      const hit = new RegExp(p.regex).exec(haystack);
      if (hit) bad.push(`le motif « ${p.name} » se retrouve encore (${hit[0].slice(0, 24)}…)`);
    }

    // L'autre moitié : caviarder ne doit pas tuer le signal.
    const ref = parseRule(fxYaml('redaction/rule.yaml'), 'règle de référence');
    if (!ref.ok) return `la règle de référence du corpus ne se lit plus : ${ref.error}`;
    const kept = perfect(ref.value, { ...c, events: redacted }, 'le corpus caviardé, la détection de référence');
    if (kept) bad.push(`${kept} — le caviardage a emporté un champ dont la détection a besoin`);

    return bad.length ? bad.slice(0, 4).join(' · ') : null;
  },

  'ecs-fields': () => {
    const rel = 'logging/field-mapping.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const parsed = parseMapping(doc.value);
    if (!parsed.ok) return parsed.error;

    const raw = fxNdjson('ecs-fields/raw.ndjson');
    const cases = fxJson<Corpus['cases']>('ecs-fields/cases.json') ?? [];
    const mapped = applyMapping(raw, parsed.value);
    const ref = parseRule(fxYaml('ecs-fields/rule.yaml'), 'règle fournie');
    if (!ref.ok) return `la règle fournie ne se lit plus : ${ref.error}`;

    const withTs = mapped.filter((ev) => !Number.isNaN(Date.parse(String(ev['@timestamp'] ?? ''))));
    if (!withTs.length) {
      return 'aucun événement normalisé ne porte d’`@timestamp` lisible : la règle ne peut même pas ouvrir sa fenêtre';
    }
    return perfect(ref.value, { name: 'ecs-fields', events: mapped, cases }, 'le corpus normalisé, avec la règle fournie inchangée');
  },

  'ecs-lint': () => {
    const rel = 'logging/events.ndjson';
    const produced = loadNdjson(rel);
    if (!produced.ok) return produced.error;
    const reference = fxNdjson('ecs-lint/events.ndjson');

    const idOf = (ev: EcsEvent) => String(getPath(ev, 'event.id') ?? '');
    const byId = new Map(produced.value.map((ev) => [idOf(ev), ev]));
    const bad: string[] = [];

    const lost = reference.filter((ev) => !byId.has(idOf(ev))).map(idOf);
    if (lost.length) bad.push(`${lost.length} ligne(s) ont disparu (${lost.slice(0, 3).join(', ')}) — corriger un journal n’est pas le vider`);
    const extra = [...byId.keys()].filter((id) => !reference.some((ev) => idOf(ev) === id));
    if (extra.length) bad.push(`${extra.length} ligne(s) inventée(s) (${extra.slice(0, 3).join(', ')})`);

    for (const ref of reference) {
      const mine = byId.get(idOf(ref));
      if (!mine) continue;
      if (String(mine['@timestamp']) !== String(ref['@timestamp'])) {
        bad.push(`${idOf(ref)} : l’horodatage a changé — on répare la valeur, pas le fait`);
      }
      if (String(mine.message ?? '') !== String(ref.message ?? '')) {
        bad.push(`${idOf(ref)} : le message a changé`);
      }
    }
    for (const ev of produced.value) bad.push(...lintEvent(ev));
    return bad.length ? `${bad.length} problème(s) : ${bad.slice(0, 4).join(' · ')}` : null;
  },

  'logging-inventory': () => {
    const rel = 'program/logging-inventory.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const entries = arr(obj(doc.value)?.events);
    if (!entries.length) return `\`workspace/${rel}\` ne déclare aucun événement sous \`events\``;

    const emitted = fxNdjson('inventory/emitted.ndjson');
    const byAction = new Map<string, EcsEvent[]>();
    for (const ev of emitted) {
      const action = String(getPath(ev, 'event.action') ?? '');
      const bucket = byAction.get(action);
      if (bucket) bucket.push(ev); else byAction.set(action, [ev]);
    }
    /** Les champs du socle présents dans TOUTES les instances d'un événement. */
    const always = (action: string) =>
      [...CORE_FIELDS, 'url.path', 'http.request.method', 'http.response.status_code']
        .filter((f) => byAction.get(action)!.every((ev) => getPath(ev, f) !== undefined));

    const bad: string[] = [];
    const declared = new Set<string>();
    for (const raw of entries) {
      const e = obj(raw);
      if (!e) { bad.push('une entrée de `events` n’est pas un objet'); continue; }
      const action = str(e.event);
      if (!byAction.has(action)) {
        bad.push(`« ${action || '(sans nom)'} » est documenté mais n’est jamais émis`);
        continue;
      }
      declared.add(action);
      const fields = new Set(list(e.fields));
      const expected = always(action);
      const lacking = expected.filter((f) => !fields.has(f));
      const surplus = [...fields].filter((f) => !expected.includes(f));
      if (lacking.length) bad.push(`${action} : ${lacking.join(', ')} est émis à chaque fois mais n’est pas documenté`);
      if (surplus.length) bad.push(`${action} : ${surplus.join(', ')} est documenté mais n’est pas toujours présent`);
    }
    const undocumented = [...byAction.keys()].filter((a) => !declared.has(a));
    if (undocumented.length) {
      bad.push(`${undocumented.length} événement(s) émis mais non documentés : ${undocumented.slice(0, 3).join(', ')}`);
    }
    return bad.length ? bad.slice(0, 5).join(' · ') : null;
  },

  // ── Écrire des règles ─────────────────────────────────────────────────────

  'rule-credential-stuffing': () => {
    const cs = corpus('cs');
    const hold = corpus('cs-holdout');
    const rule = ruleOf('detections/credential-stuffing.yaml', [cs, hold]);
    if (!rule.ok) return rule.error;
    return lines(
      perfect(rule.value, cs, 'le corpus'),
      atLeast(rule.value, hold, 1, 0.9, 'le second corpus, tiré des mêmes générateurs avec une autre graine'),
    );
  },

  'rule-threshold': () => {
    const rel = 'detections/thresholds.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const o = obj(doc.value);
    const thresholds = obj(o?.thresholds) ?? {};
    const windowMs = parseDuration(o?.window);
    if (windowMs === null) {
      return `\`workspace/${rel}\` : \`window\` est absent ou illisible — attendu 30s, 5m, 2h ou 1d`;
    }
    const failures = Number(thresholds.failures);
    const users = Number(thresholds.distinct_users);
    for (const [name, value] of [['failures', failures], ['distinct_users', users]] as const) {
      if (!Number.isInteger(value) || value < 1) {
        return `\`workspace/${rel}\` : \`thresholds.${name}\` doit être un entier supérieur à zéro`;
      }
    }
    const rule: Rule = {
      id: 'credential-stuffing',
      windowMs,
      where: [{ field: 'event.action', op: 'eq', value: 'authn_login_fail' }],
      groupBy: ['source.ip'],
      having: [
        { metric: 'count', op: 'gte', value: failures },
        { metric: 'distinct', field: 'user.name', op: 'gte', value: users },
      ],
    };
    return atLeast(rule, corpus('cs-hard'), 0.9, 0.85, 'le corpus difficile');
  },

  'rule-temporal-spray': () => {
    const sp = corpus('spray');
    const hold = corpus('spray-holdout');
    const rule = ruleOf('detections/password-spray.yaml', [sp, hold]);
    if (!rule.ok) return rule.error;
    return lines(
      perfect(rule.value, sp, 'le corpus'),
      atLeast(rule.value, hold, 1, 0.9, 'le second corpus, tiré des mêmes générateurs avec une autre graine'),
    );
  },

  'honeytoken': () => {
    const c = corpus('honeytoken');
    const rule = ruleOf('detections/honeytoken.yaml', [c]);
    if (!rule.ok) return rule.error;
    return perfect(rule.value, c, 'le corpus complet');
  },

  'detect-prompt-injection': () => {
    const c = corpus('assistant');
    const rule = ruleOf('detections/prompt-injection.yaml', [c]);
    if (!rule.ok) return rule.error;
    return perfect(rule.value, c, 'le corpus de l’assistant');
  },

  'rule-silent-after-fix': () => {
    const before = corpus('silent-before');
    const after = corpus('silent-after');
    const rule = ruleOf('detections/idor-probing.yaml', [before, after]);
    if (!rule.ok) return rule.error;

    const bad: string[] = [];
    const still = perfect(rule.value, before, 'le corpus d’avant correctif');
    if (still) bad.push(`${still} — la règle doit garder sa valeur de non-régression, pas disparaître`);
    const alerts = evaluate(rule.value, after.events);
    if (alerts.length) {
      const touched = [...new Set(alerts.flatMap((a) => a.cases))].slice(0, 3);
      bad.push(`la règle lève encore ${alerts.length} fois sur le corpus d’après correctif (${touched.join(', ')}) : le contrôle refuse déjà, l’alerte n’apprend plus rien`);
    }
    return bad.length ? bad.join(' · ') : null;
  },

  // ── Outiller les règles ───────────────────────────────────────────────────

  'rule-fixtures': () => {
    const targets = ['honeytoken-access', 'admin-role-change', 'prompt-injection-external',
      'unsupported-http-method', 'mass-export'];
    const bad: string[] = [];
    for (const id of targets) {
      const rel = `detections/fixtures/${id}.yaml`;
      const doc = loadYamlDoc(rel);
      if (!doc.ok) { bad.push(doc.error); continue; }
      const parsed = parseRule(ruleFile(id)?.query, id);
      if (!parsed.ok) { bad.push(`la règle ${id} de la bibliothèque ne se lit plus : ${parsed.error}`); continue; }

      const o = obj(doc.value) ?? {};
      const positive = arr(o.positive).filter(obj) as EcsEvent[];
      const negative = arr(o.negative).filter(obj) as EcsEvent[];
      if (!positive.length || !negative.length) {
        bad.push(`${id} : il faut un \`positive\` et un \`negative\` non vides`);
        continue;
      }
      if (positive.length !== negative.length) {
        bad.push(`${id} : ${positive.length} événement(s) positifs contre ${negative.length} négatifs — le quasi-jumeau se compare un pour un`);
        continue;
      }
      const illFormed = [...positive, ...negative].find(
        (ev) => Number.isNaN(Date.parse(String(ev['@timestamp'] ?? ''))) || getPath(ev, 'event.action') === undefined,
      );
      if (illFormed) {
        bad.push(`${id} : un événement n’a pas d’\`@timestamp\` lisible ou pas d’\`event.action\``);
        continue;
      }
      if (!evaluate(parsed.value, positive).length) bad.push(`${id} : la règle n’attrape pas sa fixture positive`);
      if (evaluate(parsed.value, negative).length) bad.push(`${id} : la règle attrape sa fixture négative`);

      // Le quasi-jumeau : assez proche pour que la différence soit le sujet.
      const skip = (k: string) => k.startsWith('@timestamp') || k.startsWith('event.id') || k.startsWith('message');
      for (const [i, pos] of positive.entries()) {
        const a = leaves(pos);
        const b = leaves(negative[i]);
        const keys = new Set([...a.keys(), ...b.keys()].filter((k) => !skip(k)));
        const diff = [...keys].filter((k) => a.get(k) !== b.get(k));
        if (diff.length === 0) bad.push(`${id} : la fixture négative n°${i + 1} est identique à la positive`);
        else if (diff.length > 2) {
          bad.push(`${id} : la fixture négative n°${i + 1} diffère par ${diff.length} champs (${diff.slice(0, 3).join(', ')}) — un quasi-jumeau en change un ou deux, sinon il ne prouve rien`);
        }
      }
    }
    return bad.length ? bad.slice(0, 5).join(' · ') : null;
  },

  'rule-lint': () => {
    const ids = RULE_IDS();
    if (!ids.length) return 'la bibliothèque de règles est introuvable dans les fixtures';
    const bad: string[] = [];
    const seenIds = new Map<string, string>();

    for (const id of ids) {
      const rel = `detections/rules/${id}.yaml`;
      const doc = loadYamlDoc(rel);
      if (!doc.ok) { bad.push(doc.error); continue; }
      const rule = obj(doc.value);
      if (!rule) { bad.push(`\`workspace/${rel}\` n’est pas un objet YAML`); continue; }

      for (const key of ['id', 'name', 'description', 'severity', 'risk_score', 'tags', 'interval', 'from', 'note', 'query']) {
        if (rule[key] === undefined) bad.push(`${id} : la clé \`${key}\` manque`);
      }
      if (str(rule.id) !== id) bad.push(`${id} : le champ \`id\` (« ${str(rule.id)} ») ne correspond pas au nom du fichier`);
      const previous = seenIds.get(str(rule.id));
      if (previous) bad.push(`${id} : l’identifiant « ${str(rule.id)} » est déjà celui de ${previous}`);
      seenIds.set(str(rule.id), id);

      const severity = str(rule.severity);
      const RANGE: Record<string, [number, number]> = {
        low: [0, 21], medium: [22, 47], high: [48, 73], critical: [74, 99],
      };
      if (!(severity in RANGE)) bad.push(`${id} : sévérité « ${severity || '(absente)'} » inconnue — low, medium, high ou critical`);
      else {
        const [lo, hi] = RANGE[severity];
        const risk = Number(rule.risk_score);
        if (!Number.isInteger(risk) || risk < lo || risk > hi) {
          bad.push(`${id} : score de risque ${rule.risk_score} hors de la plage de la sévérité ${severity} (${lo}–${hi})`);
        }
      }
      const tags = list(rule.tags);
      const duplicated = tags.filter((t, i) => tags.indexOf(t) !== i);
      if (duplicated.length) bad.push(`${id} : l’étiquette « ${duplicated[0]} » est en double`);
      if (['high', 'critical'].includes(severity) && !/^##\s*Triage\b/mi.test(String(rule.note ?? ''))) {
        bad.push(`${id} : sévérité ${severity} et note sans section « ## Triage » — personne ne saura quoi en faire à trois heures du matin`);
      }
      const interval = parseDuration(rule.interval);
      const lookback = parseDuration(String(rule.from ?? '').replace(/^now-/, ''));
      if (interval === null) bad.push(`${id} : \`interval\` est absent ou illisible`);
      if (lookback === null) bad.push(`${id} : \`from\` est absent ou illisible — sans fenêtre d’historique, la règle laisse des trous entre deux exécutions`);
      else if (interval !== null && lookback <= interval) {
        bad.push(`${id} : la fenêtre d’historique (${String(rule.from)}) ne dépasse pas l’intervalle (${String(rule.interval)}) — un événement peut passer entre deux exécutions`);
      }
      const parsed = parseRule(rule.query, `${id}.query`);
      if (!parsed.ok) { bad.push(parsed.error); continue; }
      if (JSON.stringify(rule.query) !== JSON.stringify(ruleFile(id)?.query)) {
        bad.push(`${id} : la requête a été modifiée — les cinq défauts sont dans les métadonnées, et une règle « corrigée » qui ne cherche plus rien ne corrige rien`);
      }
    }
    return bad.length ? `${bad.length} problème(s) : ${bad.slice(0, 4).join(' · ')}` : null;
  },

  'atomic-test': () => {
    const rel = 'detections/atomics/credential-stuffing.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const o = obj(doc.value) ?? {};
    const phases: Record<string, AtomicStep[]> = {};
    for (const name of ['setup', 'detonation', 'rollback']) {
      if (!arr(o[name]).length) return `\`workspace/${rel}\` : la phase \`${name}\` est absente ou vide — l’atomique tient en trois temps`;
      const steps = expand(o[name], `${name}`);
      if (!steps.ok) return steps.error;
      phases[name] = steps.value;
    }
    const seed = fxJson<{ accounts: Record<string, string> }>('atomic/accounts.json')?.accounts ?? {};
    const ref = parseRule(fxYaml('atomic/rule.yaml'), 'règle de référence');
    if (!ref.ok) return `la règle de référence ne se lit plus : ${ref.error}`;

    const run = runAtomic(phases.setup, phases.detonation, phases.rollback, seed);
    const bad: string[] = [];

    const silentAfterSetup = evaluate(ref.value, run.events.slice(0, run.phases.setup));
    if (silentAfterSetup.length) bad.push('la règle lève déjà après la mise en place : la détonation n’est plus ce qui la déclenche');

    const afterDetonation = evaluate(ref.value, run.events.slice(0, run.phases.detonation));
    if (!afterDetonation.length) {
      bad.push('la règle reste muette après la détonation — l’attaque simulée ne franchit pas ses seuils (fixtures/m18/atomic/rule.yaml)');
    }

    const restored = JSON.stringify(Object.entries(run.accounts).sort()) === JSON.stringify(Object.entries(seed).sort());
    if (!restored) {
      const added = Object.keys(run.accounts).filter((k) => !(k in seed));
      const removed = Object.keys(seed).filter((k) => !(k in run.accounts));
      bad.push(`le retour arrière ne rétablit pas l’état initial (${added.length} compte(s) en trop, ${removed.length} manquant(s))`);
    }

    // Le retour arrière ne doit pas lever tout seul : sinon l'atomique
    // fabrique son propre signal et ne prouve rien de la détonation.
    const withoutDetonation = runAtomic(phases.setup, [], phases.rollback, seed);
    if (evaluate(ref.value, withoutDetonation.events).length) {
      bad.push('la mise en place et le retour arrière font lever la règle à eux seuls');
    }

    // Rejouable : deux exécutions depuis le même état donnent le même résultat.
    const second = runAtomic(phases.setup, phases.detonation, phases.rollback, seed);
    const sameAlerts = evaluate(ref.value, second.events.slice(0, second.phases.detonation)).length === afterDetonation.length;
    const sameState = JSON.stringify(Object.entries(second.accounts).sort()) === JSON.stringify(Object.entries(run.accounts).sort());
    if (!sameAlerts || !sameState) bad.push('deux exécutions successives ne donnent pas le même résultat : l’atomique n’est pas rejouable');

    return bad.length ? bad.join(' · ') : null;
  },

  'appsensor-points': () => {
    const rel = 'detections/appsensor.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const entries = arr(obj(doc.value)?.points);
    if (!entries.length) return `\`workspace/${rel}\` ne déclare aucun point sous \`points\``;

    const c = corpus('appsensor');
    const benign = new Set(c.cases.filter((k) => !k.malicious).map((k) => k.id));
    const bad: string[] = [];
    const seen = new Set<string>();

    for (const raw of entries) {
      const p = obj(raw);
      if (!p) { bad.push('une entrée de `points` n’est pas un objet'); continue; }
      const id = str(p.id).toUpperCase();
      if (!(id in APPSENSOR_CASES)) {
        bad.push(`« ${id || '(sans identifiant)'} » n’est pas un point du catalogue (fixtures/m18/appsensor/catalogue.yaml)`);
        continue;
      }
      seen.add(id);
      const parsed = parseRule(p, `${id}`);
      if (!parsed.ok) { bad.push(parsed.error); continue; }
      const hard = hardcodingError(parsed.value, [c]);
      if (hard) { bad.push(`${id} : ${hard}`); continue; }

      const alerts = evaluate(parsed.value, c.events);
      const touched = new Set(alerts.flatMap((a) => a.cases));
      if (!touched.has(APPSENSOR_CASES[id])) bad.push(`${id} ne se déclenche pas sur le trafic qui le concerne`);
      const falsePositives = [...touched].filter((k) => benign.has(k));
      if (falsePositives.length) {
        const labels = c.cases.filter((k) => falsePositives.includes(k.id)).map((k) => k.label);
        bad.push(`${id} se déclenche sur le parcours légitime : ${[...new Set(labels)].slice(0, 2).join(', ')}`);
      }
    }
    const forgotten = Object.keys(APPSENSOR_CASES).filter((id) => !seen.has(id));
    if (forgotten.length) bad.push(`aucun point déclaré pour ${forgotten.join(', ')}`);
    return bad.length ? bad.slice(0, 5).join(' · ') : null;
  },

  'graduated-response': () => {
    const rel = 'detections/response-policy.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const entries = arr(obj(doc.value)?.stages);
    if (!entries.length) return `\`workspace/${rel}\` ne déclare aucun palier sous \`stages\``;

    const c = corpus('graduated');
    const expected = fxJson<{ expected: Record<string, string> }>('graduated/expected.json')?.expected ?? {};
    const rules = new Map<string, Rule>();
    const bad: string[] = [];

    for (const raw of entries) {
      const s = obj(raw);
      if (!s) { bad.push('une entrée de `stages` n’est pas un objet'); continue; }
      const stage = str(s.stage);
      if (!STAGES.includes(stage)) {
        bad.push(`« ${stage || '(sans nom)'} » n’est pas un palier — ${STAGES.join(', ')}`);
        continue;
      }
      const parsed = parseRule(s, stage);
      if (!parsed.ok) { bad.push(parsed.error); continue; }
      const hard = hardcodingError(parsed.value, [c]);
      if (hard) { bad.push(`${stage} : ${hard}`); continue; }
      rules.set(stage, parsed.value);
    }
    const forgotten = STAGES.filter((s) => !rules.has(s));
    if (forgotten.length) bad.push(`aucun palier déclaré pour ${forgotten.join(', ')}`);
    if (bad.length) return bad.slice(0, 4).join(' · ');

    const touchedBy = new Map<string, Set<string>>();
    for (const stage of STAGES) {
      touchedBy.set(stage, new Set(evaluate(rules.get(stage)!, c.events).flatMap((a) => a.cases)));
    }
    const reached = (caseId: string) => {
      let best = 'aucun';
      for (const stage of STAGES) if (touchedBy.get(stage)!.has(caseId)) best = stage;
      return best;
    };

    const wrong: string[] = [];
    for (const k of c.cases) {
      const want = expected[k.id] ?? 'aucun';
      const got = reached(k.id);
      if (got !== want) wrong.push(`${k.label} atteint « ${got} » au lieu de « ${want} »`);
      // La graduation doit être réelle : un cas qui verrouille est passé par
      // les paliers d'avant, sinon la réponse saute des étapes.
      const at = STAGES.indexOf(got);
      for (let i = 0; i < at; i += 1) {
        if (!touchedBy.get(STAGES[i])!.has(k.id)) {
          wrong.push(`${k.label} atteint « ${got} » sans passer par « ${STAGES[i]} » : la réponse n’est pas graduée`);
          break;
        }
      }
    }
    return wrong.length ? `${wrong.length} cas mal classés : ${[...new Set(wrong)].slice(0, 4).join(' · ')}` : null;
  },

  // ── Documenter, couvrir, investiguer ──────────────────────────────────────

  'ads-documentation': () => {
    const rel = 'detections/ads/credential-stuffing.md';
    const raw = wsText(rel);
    if (raw === null) return missing(rel);
    if (!raw.trim()) return `\`workspace/${rel}\` est vide`;

    const normalise = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').trim();
    const sections = new Map<string, string>();
    let current = '';
    for (const line of raw.split('\n')) {
      const heading = line.match(/^##\s+(.*)$/);
      if (heading) { current = normalise(heading[1]); sections.set(current, ''); continue; }
      if (current) sections.set(current, `${sections.get(current)}\n${line}`);
    }

    const REQUIRED = [
      'objectif', 'categorisation', 'strategie', 'contexte technique',
      'angles morts', 'faux positifs', 'validation', 'priorite', 'reponse',
    ];
    const bad: string[] = [];
    const find = (needle: string) => [...sections.entries()].find(([k]) => k.includes(needle));
    for (const needle of REQUIRED) {
      const hit = find(needle);
      if (!hit) { bad.push(`la rubrique « ${needle} » manque`); continue; }
      if (needle !== 'validation' && hit[1].trim().length < 40) {
        bad.push(`la rubrique « ${needle} » tient en moins de quarante caractères`);
      }
    }

    const categorisation = find('categorisation')?.[1] ?? '';
    const cited = [...categorisation.matchAll(/\bT\d{4}(?:\.\d{3})?\b/g)].map((m) => m[0]);
    const known = techniques();
    if (!cited.length) bad.push('la rubrique « catégorisation » ne cite aucune technique ATT&CK');
    for (const id of cited) {
      const technique = known.find((t) => t.id === id);
      if (!technique) bad.push(`la technique ${id} est inconnue du catalogue`);
      else if (technique.deprecated) bad.push(`la technique ${id} (${technique.name}) est dépréciée`);
    }

    const validation = find('validation')?.[1] ?? '';
    const block = validation.match(/```ya?ml\s*\n([\s\S]*?)```/);
    if (!block) bad.push('la rubrique « validation » ne contient pas de bloc ```yaml : le harnais l’exécute, il faut donc qu’il y ait quelque chose à exécuter');
    else {
      let parsedYaml: unknown;
      try {
        parsedYaml = loadYaml(block[1]);
      } catch (err) {
        bad.push(`le bloc de validation n’est pas du YAML valide (${(err as Error).message.split('\n')[0]})`);
        parsedYaml = undefined;
      }
      if (parsedYaml !== undefined) {
        const cs = corpus('cs');
        const parsed = parseRule(parsedYaml, 'recette de validation');
        if (!parsed.ok) bad.push(parsed.error);
        else {
          const hard = hardcodingError(parsed.value, [cs]);
          if (hard) bad.push(hard);
          else {
            const failure = atLeast(parsed.value, cs, 1, 0.9, 'le corpus');
            if (failure) bad.push(`la recette de validation ne prouve rien : ${failure}`);
          }
        }
      }
    }
    return bad.length ? bad.slice(0, 4).join(' · ') : null;
  },

  'detection-coverage': () => {
    const rel = 'detections/coverage.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const o = obj(doc.value) ?? {};
    const bad: string[] = [];

    const known = techniques();
    const ids = RULE_IDS();
    const declaredTechnique = new Map<string, string>();
    for (const raw of arr(o.rules)) {
      const r = obj(raw);
      if (!r) { bad.push('une entrée de `rules` n’est pas un objet'); continue; }
      const id = str(r.id);
      if (!ids.includes(id)) { bad.push(`la règle « ${id || '(sans identifiant)'} » n’existe pas dans la bibliothèque`); continue; }
      const technique = str(r.technique);
      const hit = known.find((t) => t.id === technique);
      if (!technique) bad.push(`${id} ne cite aucune technique`);
      else if (!hit) bad.push(`${id} cite la technique ${technique}, inconnue du catalogue`);
      else if (hit.deprecated) bad.push(`${id} cite la technique ${technique} (${hit.name}), dépréciée`);
      declaredTechnique.set(id, technique);
    }
    const untyped = ids.filter((id) => !declaredTechnique.has(id));
    if (untyped.length) bad.push(`${untyped.length} règle(s) sans technique déclarée : ${untyped.slice(0, 3).join(', ')}`);

    const replayed = replayCoverage();
    const declaredScenarios = new Set<string>();
    for (const raw of arr(o.scenarios)) {
      const s = obj(raw);
      if (!s) { bad.push('une entrée de `scenarios` n’est pas un objet'); continue; }
      const id = str(s.id);
      if (!replayed.has(id)) { bad.push(`le scénario « ${id || '(sans identifiant)'} » n’existe pas`); continue; }
      declaredScenarios.add(id);
      const claimed = [...new Set(list(s.triggers))].sort();
      const unknownRules = claimed.filter((r) => !ids.includes(r));
      if (unknownRules.length) { bad.push(`${id} cite des règles inexistantes : ${unknownRules.join(', ')}`); continue; }
      const actual = replayed.get(id)!;
      const lacking = actual.filter((r) => !claimed.includes(r));
      const surplus = claimed.filter((r) => !actual.includes(r));
      if (lacking.length) bad.push(`${id} déclenche aussi ${lacking.join(', ')}, qui n’est pas déclaré`);
      if (surplus.length) bad.push(`${id} déclare ${surplus.join(', ')}, qui ne lève pas au rejeu`);
    }
    const forgotten = [...replayed.keys()].filter((id) => !declaredScenarios.has(id));
    if (forgotten.length) bad.push(`${forgotten.length} scénario(s) non déclarés : ${forgotten.slice(0, 3).join(', ')}`);

    const covered = new Set([...replayed.values()].flat());
    const holes = ids.filter((id) => !covered.has(id)).sort();
    const claimedHoles = [...new Set(list(o.uncovered))].sort();
    if (JSON.stringify(holes) !== JSON.stringify(claimedHoles)) {
      bad.push(`le trou de couverture n’est pas nommé correctement : \`uncovered\` déclare [${claimedHoles.join(', ') || '—'}] alors que ${holes.length} règle(s) ne sont déclenchées par aucun scénario`);
    }
    return bad.length ? bad.slice(0, 5).join(' · ') : null;
  },

  'incident-timeline': () => {
    const rel = 'incident/timeline.yaml';
    const doc = loadYamlDoc(rel);
    if (!doc.ok) return doc.error;
    const o = obj(doc.value) ?? {};
    const claimed = list(o.evenements ?? o.events);
    if (!claimed.length) return `\`workspace/${rel}\` ne liste aucun événement sous \`evenements\``;

    const log = fxNdjson('incident/log.ndjson');
    const byId = new Map(log.map((ev) => [String(getPath(ev, 'event.id') ?? ''), ev]));
    const bad: string[] = [];

    const unknownIds = claimed.filter((id) => !byId.has(id));
    if (unknownIds.length) bad.push(`${unknownIds.length} identifiant(s) n’existent pas dans le journal (${unknownIds.slice(0, 3).join(', ')})`);

    const truth = new Set(INCIDENT_TRUTH);
    const lacking = INCIDENT_TRUTH.filter((id) => !claimed.includes(id));
    const surplus = claimed.filter((id) => !truth.has(id));
    if (lacking.length) bad.push(`${lacking.length} événement(s) de l’incident manquent`);
    if (surplus.length) bad.push(`${surplus.length} événement(s) en trop, qui n’appartiennent pas à l’incident`);
    if (!lacking.length && !surplus.length) {
      const ordered = [...claimed].sort(
        (a, b) => String(byId.get(a)?.['@timestamp']).localeCompare(String(byId.get(b)?.['@timestamp'])),
      );
      if (JSON.stringify(ordered) !== JSON.stringify(claimed)) bad.push('la liste n’est pas dans l’ordre chronologique');
    }

    const exfiltration = INCIDENT_TRUTH.find((id) => String(getPath(byId.get(id), 'event.action')) === 'webhook_sent');
    if (str(o.entree) !== INCIDENT_TRUTH[0]) bad.push('`entree` ne désigne pas le premier événement de l’incident — par où c’est entré');
    if (str(o.exfiltration) !== exfiltration) bad.push('`exfiltration` ne désigne pas l’événement par lequel les données sont sorties');
    return bad.length ? bad.join(' · ') : null;
  },
};
