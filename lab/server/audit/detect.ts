// Le moteur de détection du lab — M18.
//
// Pourquoi un langage de requête maison, et pas KQL, EQL ou ES|QL ? Parce que
// le lab ne peut pas exécuter Elastic. Or une règle qu'on ne peut pas exécuter
// ne s'évalue pas : elle se relit, ce qui revient à noter de la prose. Le geste
// travaillé dans ce module n'est pas la syntaxe d'un produit — elle s'apprend
// en une heure et change tous les dix-huit mois — c'est le **réglage
// précision/rappel** contre un corpus étiqueté. Ça, c'est transposable tel
// quel à Elastic, Splunk, Sentinel ou Sigma.
//
// Le langage tient donc en cinq clés, documentées dans `fixtures/m18/README.md` :
//
//   where     — le filtre, événement par événement
//   window    — la fenêtre glissante (absente = tout le corpus)
//   group_by  — l'axe d'agrégation
//   having    — la condition sur le groupe dans la fenêtre
//   (rien)    — sans `having`, chaque événement filtré est une alerte
//
// Trois invariants tiennent ce fichier :
//
//   1. **Le corpus est étiqueté par cas, pas par événement.** Un cas, c'est un
//      acteur qui se comporte dans le temps : douze attaquants, quarante
//      leurres. Une alerte qui touche un cas légitime est un faux positif,
//      quelle que soit la façon dont la règle a agrégé.
//
//   2. **Une règle ne peut pas nommer ce qu'elle doit trouver.** Les champs
//      d'identifiant et l'horodatage sont interdits en filtre, et toute valeur
//      littérale qui coïncide avec un identifiant du corpus fait rejeter la
//      règle. Sinon l'exercice se résout en recopiant douze identifiants.
//
//   3. **Le moteur ne voit jamais l'étiquette.** Les clés de tête `_` sont
//      retirées des événements avant évaluation : `_case` sert au scoreur, pas
//      à la règle.

import fs from 'node:fs';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { LAB_ROOT } from './workspace.ts';

/** Les fixtures du module. Tous les chemins de ce fichier sont relatifs à ce dossier. */
export const FIXTURES = path.join(LAB_ROOT, 'fixtures', 'm18');

// ── Lecture des fixtures ────────────────────────────────────────────────────

export type EcsEvent = Record<string, unknown>;

const fxPath = (rel: string): string | null => {
  const full = path.resolve(FIXTURES, rel);
  return full.startsWith(FIXTURES + path.sep) ? full : null;
};

export function fxText(rel: string): string | null {
  const full = fxPath(rel);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return fs.readFileSync(full, 'utf8');
}

export function fxJson<T = unknown>(rel: string): T | null {
  const raw = fxText(rel);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function fxYaml<T = unknown>(rel: string): T | null {
  const raw = fxText(rel);
  if (raw === null) return null;
  try {
    return (loadYaml(raw) ?? {}) as T;
  } catch {
    return null;
  }
}

export function fxNdjson(rel: string): EcsEvent[] {
  const raw = fxText(rel);
  if (raw === null) return [];
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as EcsEvent);
}

export function fxList(rel: string): string[] {
  const full = fxPath(rel);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isDirectory()) return [];
  return fs.readdirSync(full).filter((f) => fs.statSync(path.join(full, f)).isFile()).sort();
}

// ── Corpus ──────────────────────────────────────────────────────────────────

export interface CaseDef {
  id: string;
  /** Vrai pour un cas que la règle doit lever. */
  malicious: boolean;
  /** Ce qu'est le cas, en français : « test de charge », « passerelle SSO ». */
  label: string;
}

export interface Corpus {
  name: string;
  events: EcsEvent[];
  cases: CaseDef[];
}

export function loadCorpus(dir: string, file = 'events.ndjson'): Corpus {
  return {
    name: dir,
    events: fxNdjson(`${dir}/${file}`),
    cases: fxJson<CaseDef[]>(`${dir}/cases.json`) ?? [],
  };
}

/** L'événement tel que le moteur le voit : sans les clés d'étiquetage. */
function visible(ev: EcsEvent): EcsEvent {
  const out: EcsEvent = {};
  for (const [k, v] of Object.entries(ev)) if (!k.startsWith('_')) out[k] = v;
  return out;
}

const caseOf = (ev: EcsEvent) => String(ev._case ?? '');

// ── Le langage ──────────────────────────────────────────────────────────────

export type Op =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'not_in'
  | 'exists' | 'missing'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'matches' | 'not_matches';

const OPS: Op[] = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'exists', 'missing',
  'contains', 'not_contains', 'starts_with', 'ends_with', 'matches', 'not_matches',
];

export interface Cond {
  field: string;
  op: Op;
  value?: unknown;
}

export type Filter = Cond | { any_of: Filter[] } | { all_of: Filter[] } | { none_of: Filter[] };

export type Metric = 'count' | 'distinct' | 'sum' | 'ratio';

export interface Having {
  metric: Metric;
  field?: string;
  where?: Filter | Filter[];
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
  value: number;
}

export interface Rule {
  id: string;
  /** Fenêtre glissante en millisecondes. `null` = tout le corpus. */
  windowMs: number | null;
  where: Filter[];
  groupBy: string[];
  having: Having[];
}

// ── Analyse d'une règle ─────────────────────────────────────────────────────

/** Champs qu'une règle n'a pas le droit de nommer : ils désignent l'événement. */
const FORBIDDEN_FIELDS = [
  'event.id', '_id', 'id', '_case', 'case', 'labels', 'label', 'truth',
  'event.sequence', 'log.offset', '@timestamp', 'timestamp',
];

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

export const DURATION = /^(\d+)\s*(s|m|h|d)$/;

export function parseDuration(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v * 1000;
  const m = String(v ?? '').trim().match(DURATION);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = <T>(error: string): Parsed<T> => ({ ok: false, error });

function parseFilter(raw: unknown, at: string): Parsed<Filter> {
  const o = obj(raw);
  if (!o) return fail(`${at} n’est pas une condition (il faut un objet \`field/op/value\`)`);

  for (const key of ['any_of', 'all_of', 'none_of'] as const) {
    if (o[key] !== undefined) {
      const list = asList(o[key]);
      if (!list.length) return fail(`${at}.${key} est vide`);
      const kids: Filter[] = [];
      for (const [i, k] of list.entries()) {
        const p = parseFilter(k, `${at}.${key}[${i}]`);
        if (!p.ok) return p;
        kids.push(p.value);
      }
      return { ok: true, value: { [key]: kids } as Filter };
    }
  }

  const field = typeof o.field === 'string' ? o.field.trim() : '';
  if (!field) return fail(`${at} n’a pas de champ \`field\``);
  const op = String(o.op ?? '').trim() as Op;
  if (!OPS.includes(op)) {
    return fail(`${at} utilise l’opérateur inconnu « ${o.op ?? '(absent)'} » — les opérateurs du lab sont ${OPS.join(', ')}`);
  }
  const needsValue = op !== 'exists' && op !== 'missing';
  if (needsValue && o.value === undefined) return fail(`${at} (${op}) n’a pas de \`value\``);
  if ((op === 'in' || op === 'not_in') && !Array.isArray(o.value)) {
    return fail(`${at} (${op}) attend une liste en \`value\``);
  }
  if (op === 'matches' || op === 'not_matches') {
    const pattern = String(o.value ?? '');
    if (pattern.length > 200) return fail(`${at} : l’expression régulière dépasse 200 caractères`);
    try {
      new RegExp(pattern);
    } catch (err) {
      return fail(`${at} : « ${pattern} » n’est pas une expression régulière valide (${(err as Error).message.split('\n')[0]})`);
    }
  }
  return { ok: true, value: { field, op, value: o.value } };
}

function parseHaving(raw: unknown, at: string): Parsed<Having> {
  const o = obj(raw);
  if (!o) return fail(`${at} n’est pas une condition d’agrégat`);
  const metric = String(o.metric ?? '').trim() as Metric;
  if (!['count', 'distinct', 'sum', 'ratio'].includes(metric)) {
    return fail(`${at} : métrique inconnue « ${o.metric ?? '(absente)'} » — count, distinct, sum ou ratio`);
  }
  const op = String(o.op ?? '').trim();
  if (!['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(op)) {
    return fail(`${at} : comparateur inconnu « ${o.op ?? '(absent)'} » — eq, ne, gt, gte, lt ou lte`);
  }
  if (typeof o.value !== 'number' || !Number.isFinite(o.value)) {
    return fail(`${at} : \`value\` doit être un nombre`);
  }
  const having: Having = { metric, op: op as Having['op'], value: o.value };
  if (metric === 'distinct' || metric === 'sum') {
    if (typeof o.field !== 'string' || !o.field.trim()) {
      return fail(`${at} : la métrique ${metric} exige un \`field\``);
    }
    having.field = o.field.trim();
  }
  if (metric === 'ratio') {
    if (o.where === undefined) return fail(`${at} : la métrique ratio exige un \`where\``);
    const list: Filter[] = [];
    for (const [i, f] of asList(o.where).entries()) {
      const p = parseFilter(f, `${at}.where[${i}]`);
      if (!p.ok) return fail(p.error);
      list.push(p.value);
    }
    having.where = list;
  }
  return { ok: true, value: having };
}

/**
 * Lit une règle écrite par l'apprenant. Le message d'erreur nomme la clé
 * fautive : une règle qu'on n'arrive pas à lire n'est pas une règle qui ne
 * lève pas, et la vérification doit dire laquelle des deux on a.
 */
export function parseRule(raw: unknown, id = 'règle'): Parsed<Rule> {
  const o = obj(raw);
  if (!o) return fail(`${id} : le document n’est pas un objet YAML`);

  const where: Filter[] = [];
  for (const [i, f] of asList(o.where).entries()) {
    const p = parseFilter(f, `${id}.where[${i}]`);
    if (!p.ok) return fail(p.error);
    where.push(p.value);
  }

  const having: Having[] = [];
  for (const [i, h] of asList(o.having).entries()) {
    const p = parseHaving(h, `${id}.having[${i}]`);
    if (!p.ok) return fail(p.error);
    having.push(p.value);
  }

  const groupBy = asList(o.group_by).map(String).filter(Boolean);

  let windowMs: number | null = null;
  if (o.window !== undefined && o.window !== null) {
    windowMs = parseDuration(o.window);
    if (windowMs === null) {
      return fail(`${id} : la fenêtre « ${String(o.window)} » ne se lit pas — attendu 30s, 5m, 2h ou 1d`);
    }
  }

  if (!where.length && !having.length) {
    return fail(`${id} : ni \`where\` ni \`having\` — cette règle lèverait sur chaque ligne du corpus`);
  }
  if (groupBy.length && !having.length) {
    return fail(`${id} : \`group_by\` sans \`having\` — rien ne dit ce que le groupe doit vérifier`);
  }

  return { ok: true, value: { id: String(o.id ?? id), windowMs, where, groupBy, having } };
}

// ── Garde-fou anti-codage en dur ────────────────────────────────────────────

function fieldsOf(f: Filter, out: string[]): void {
  const o = f as Record<string, unknown>;
  for (const key of ['any_of', 'all_of', 'none_of']) {
    if (Array.isArray(o[key])) {
      for (const k of o[key] as Filter[]) fieldsOf(k, out);
      return;
    }
  }
  out.push(String((f as Cond).field));
}

function valuesOf(f: Filter, out: string[]): void {
  const o = f as Record<string, unknown>;
  for (const key of ['any_of', 'all_of', 'none_of']) {
    if (Array.isArray(o[key])) {
      for (const k of o[key] as Filter[]) valuesOf(k, out);
      return;
    }
  }
  for (const v of asList((f as Cond).value)) if (typeof v === 'string') out.push(v);
}

/**
 * Refuse une règle qui désigne ce qu'elle devrait trouver.
 *
 * Deux formes : nommer un champ d'identifiant (ou l'horodatage, qui permet de
 * découper l'attaque à la minute près), et employer comme valeur littérale un
 * identifiant d'événement ou de cas du corpus. Sans ce garde-fou, recopier les
 * douze identifiants suffirait, et le challenge ne vaudrait rien.
 */
export function hardcodingError(rule: Rule, corpora: Corpus[]): string | null {
  const fields: string[] = [];
  const values: string[] = [];
  for (const f of rule.where) {
    fieldsOf(f, fields);
    valuesOf(f, values);
  }
  for (const h of rule.having) {
    if (h.field) fields.push(h.field);
    for (const f of asList(h.where) as Filter[]) {
      fieldsOf(f, fields);
      valuesOf(f, values);
    }
  }
  fields.push(...rule.groupBy);

  const banned = fields.find((f) => FORBIDDEN_FIELDS.includes(f.toLowerCase()));
  if (banned) {
    return `la règle s’appuie sur le champ « ${banned} », qui désigne l’événement au lieu de le décrire — une détection porte sur des champs métier, pas sur des identifiants ni sur l’heure exacte de l’attaque`;
  }

  const ids = new Set<string>();
  for (const c of corpora) {
    for (const ev of c.events) {
      const evt = obj(ev.event);
      if (evt && typeof evt.id === 'string') ids.add(evt.id);
      if (typeof ev._case === 'string') ids.add(ev._case);
    }
    for (const k of c.cases) ids.add(k.id);
  }
  const hit = values.find((v) => ids.has(v));
  if (hit) {
    return `la règle cite « ${hit} », un identifiant d’événement du corpus : elle liste la réponse au lieu de la décrire`;
  }
  return null;
}

// ── Évaluation ──────────────────────────────────────────────────────────────

/** Valeur d'un chemin pointé, aplatie : un tableau rend ses éléments. */
function valuesAt(ev: EcsEvent, path_: string): unknown[] {
  let current: unknown[] = [ev];
  for (const part of path_.split('.')) {
    const next: unknown[] = [];
    for (const c of current) {
      if (Array.isArray(c)) {
        for (const item of c) {
          const o = obj(item);
          if (o && o[part] !== undefined) next.push(o[part]);
        }
        continue;
      }
      const o = obj(c);
      if (o && o[part] !== undefined) next.push(o[part]);
    }
    current = next;
    if (!current.length) return [];
  }
  return current.flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v) => v !== null && v !== undefined);
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function compare(actual: unknown, op: Op, value: unknown): boolean {
  switch (op) {
    case 'eq': return String(actual) === String(value);
    case 'ne': return String(actual) !== String(value);
    case 'gt': case 'gte': case 'lt': case 'lte': {
      const a = num(actual);
      const b = num(value);
      if (a === null || b === null) return false;
      return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
    }
    case 'in': return asList(value).some((v) => String(v) === String(actual));
    case 'not_in': return !asList(value).some((v) => String(v) === String(actual));
    case 'contains': return String(actual).includes(String(value));
    case 'not_contains': return !String(actual).includes(String(value));
    case 'starts_with': return String(actual).startsWith(String(value));
    case 'ends_with': return String(actual).endsWith(String(value));
    case 'matches': return new RegExp(String(value)).test(String(actual));
    case 'not_matches': return !new RegExp(String(value)).test(String(actual));
    default: return false;
  }
}

export function passes(ev: EcsEvent, f: Filter): boolean {
  const o = f as Record<string, unknown>;
  if (Array.isArray(o.any_of)) return (o.any_of as Filter[]).some((k) => passes(ev, k));
  if (Array.isArray(o.all_of)) return (o.all_of as Filter[]).every((k) => passes(ev, k));
  if (Array.isArray(o.none_of)) return !(o.none_of as Filter[]).some((k) => passes(ev, k));

  const c = f as Cond;
  const vals = valuesAt(ev, c.field);
  if (c.op === 'exists') return vals.length > 0;
  if (c.op === 'missing') return vals.length === 0;
  // Un champ absent ne satisfait aucune comparaison, pas même une négation :
  // « pas égal à X » sur un champ qui n'existe pas est une question sans objet.
  if (!vals.length) return false;
  if (c.op === 'ne' || c.op === 'not_in' || c.op === 'not_contains' || c.op === 'not_matches') {
    return vals.every((v) => compare(v, c.op, c.value));
  }
  return vals.some((v) => compare(v, c.op, c.value));
}

const tsOf = (ev: EcsEvent): number => {
  const raw = ev['@timestamp'];
  const t = Date.parse(String(raw ?? ''));
  return Number.isFinite(t) ? t : 0;
};

function metricValue(h: Having, window: EcsEvent[]): number {
  switch (h.metric) {
    case 'count': return window.length;
    case 'distinct': {
      const seen = new Set<string>();
      for (const ev of window) for (const v of valuesAt(ev, h.field!)) seen.add(String(v));
      return seen.size;
    }
    case 'sum': {
      let total = 0;
      for (const ev of window) for (const v of valuesAt(ev, h.field!)) total += num(v) ?? 0;
      return total;
    }
    case 'ratio': {
      if (!window.length) return 0;
      const conds = (h.where ?? []) as Filter[];
      const hits = window.filter((ev) => conds.every((c) => passes(ev, c))).length;
      return hits / window.length;
    }
  }
}

const satisfies = (h: Having, window: EcsEvent[]): boolean => {
  const v = metricValue(h, window);
  switch (h.op) {
    case 'eq': return v === h.value;
    case 'ne': return v !== h.value;
    case 'gt': return v > h.value;
    case 'gte': return v >= h.value;
    case 'lt': return v < h.value;
    case 'lte': return v <= h.value;
  }
};

export interface Alert {
  /** La clé du groupe qui lève, ou l'identifiant de l'événement pour une règle sans agrégat. */
  key: string;
  at: string;
  /** Les cas du corpus dont les événements composent l'alerte. */
  cases: string[];
}

/**
 * Joue une règle sur une suite d'événements.
 *
 * Sans `having`, chaque événement filtré lève : c'est la règle « atomique »,
 * celle des honeytokens. Avec `having`, les événements filtrés sont groupés,
 * et la fenêtre glisse sur chaque événement du groupe pris comme borne haute —
 * un groupe lève dès qu'une de ses fenêtres satisfait toutes les conditions.
 */
export function evaluate(rule: Rule, events: EcsEvent[]): Alert[] {
  const kept = events.filter((ev) => rule.where.every((f) => passes(visible(ev), f)));

  if (!rule.having.length) {
    return kept.map((ev) => ({
      key: String((obj(ev.event)?.id as string) ?? ''),
      at: String(ev['@timestamp'] ?? ''),
      cases: [caseOf(ev)],
    }));
  }

  const groups = new Map<string, EcsEvent[]>();
  for (const ev of kept) {
    const view = visible(ev);
    const parts: string[] = [];
    let complete = true;
    for (const g of rule.groupBy) {
      const v = valuesAt(view, g);
      if (!v.length) { complete = false; break; }
      parts.push(String(v[0]));
    }
    if (!complete) continue; // un événement sans clé d'agrégation n'entre dans aucun groupe
    const key = parts.join(' | ') || '∅';
    const list = groups.get(key);
    if (list) list.push(ev); else groups.set(key, [ev]);
  }

  const out: Alert[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => tsOf(a) - tsOf(b));
    const span = rule.windowMs;
    let start = 0;
    for (let end = 0; end < list.length; end += 1) {
      if (span !== null) {
        const floor = tsOf(list[end]) - span;
        while (start < end && tsOf(list[start]) < floor) start += 1;
      }
      const window = list.slice(start, end + 1);
      const view = window.map(visible);
      if (rule.having.every((h) => satisfies(h, view))) {
        out.push({
          key,
          at: String(list[end]['@timestamp'] ?? ''),
          cases: [...new Set(window.map(caseOf).filter(Boolean))],
        });
        break; // un groupe qui lève lève une fois : on compte des cas, pas des alertes
      }
    }
  }
  return out;
}

// ── Notation ────────────────────────────────────────────────────────────────

export interface Score {
  tp: CaseDef[];
  fp: CaseDef[];
  fn: CaseDef[];
  precision: number;
  recall: number;
  alerts: number;
}

/**
 * Note une règle en précision et en rappel, au niveau du **cas**.
 *
 * Un cas malveillant couvert par au moins une alerte est un vrai positif ; un
 * cas légitime touché par au moins une alerte est un faux positif. Compter
 * ainsi, et non par événement, est ce qui rend la note lisible : « la règle
 * attrape le test de charge » dit quelque chose, « 412 alertes » non.
 */
export function score(alerts: Alert[], corpus: Corpus): Score {
  const byId = new Map(corpus.cases.map((c) => [c.id, c]));
  const touched = new Set<string>();
  for (const a of alerts) for (const c of a.cases) touched.add(c);

  const tp: CaseDef[] = [];
  const fp: CaseDef[] = [];
  const fn: CaseDef[] = [];
  for (const c of corpus.cases) {
    if (touched.has(c.id)) (c.malicious ? tp : fp).push(c);
    else if (c.malicious) fn.push(c);
  }
  // Une alerte qui ne touche aucun cas connu compte comme un faux positif : un
  // corpus complètement étiqueté ne laisse pas de troisième possibilité.
  for (const id of touched) {
    if (!byId.has(id)) fp.push({ id, malicious: false, label: 'événement hors corpus étiqueté' });
  }

  const precision = tp.length + fp.length === 0 ? 0 : tp.length / (tp.length + fp.length);
  const recall = tp.length + fn.length === 0 ? 0 : tp.length / (tp.length + fn.length);
  return { tp, fp, fn, precision, recall, alerts: alerts.length };
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** La phrase qui dit ce qui reste, avec les chiffres et les cas nommés. */
export function scoreSentence(s: Score, total: number): string {
  const parts = [`${s.tp.length} vrais positifs sur ${total}`];
  if (s.fp.length) {
    const names = [...new Set(s.fp.map((c) => c.label))].slice(0, 3).join(', ');
    parts.push(`${s.fp.length} faux positifs — la règle attrape ${names}`);
  } else {
    parts.push('aucun faux positif');
  }
  if (s.fn.length) {
    const names = [...new Set(s.fn.map((c) => c.label))].slice(0, 3).join(', ');
    parts.push(`il lui manque ${names}`);
  }
  parts.push(`précision ${pct(s.precision)}, rappel ${pct(s.recall)}`);
  return parts.join(' · ');
}

export const maliciousCount = (c: Corpus) => c.cases.filter((k) => k.malicious).length;
