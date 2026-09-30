// Vérifications des challenges M11 · Threat modeling & MITRE.
//
// Ce sont des challenges « artifact » : l'apprenant PRODUIT un fichier dans
// `workspace/`, et c'est ce fichier qui est jugé.
//
// Ce qui est mesuré, et rien d'autre :
//   · la **complétude structurelle** — la règle STRIDE-par-élément appliquée
//     sans trou ni catégorie hors-sujet, les sept catégories LINDDUN, la
//     couverture des routes ;
//   · la **cohérence avec le code** — chaque route déclarée dans un modèle
//     existe vraiment dans `server/`, chaque contrôle cité désigne un fichier
//     qui existe, chaque flux annoncé non authentifié l'est vraiment ;
//   · des **propriétés de graphe** — acyclicité, atteignabilité, coupure de
//     tous les chemins d'un fait vers un objectif ;
//   · des **jointures** dans les données MITRE embarquées.
//
// La PERSPICACITÉ d'un modèle — a-t-on vu la bonne menace ? — reste hors de
// portée, et les énoncés le disent. Passer ces vérifications ne veut pas dire
// « bon modèle », ça veut dire « rien d'incohérent détecté ».
//
// Écart assumé avec la spécification : elle proposait `threats/novafact.py`
// exécuté par pytm. pytm est un paquet Python, et le lab doit démarrer sans
// autre dépendance que npm — un apprenant sans Python ne pourrait pas jouer.
// Le modèle est donc déclaratif (`threats/novafact.dfd.yaml`) et passe dans le
// moteur de règles déterministe de ce fichier, qui joue exactement le rôle du
// moteur de pytm : le modèle entre, une liste de menaces reproductible sort.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exercises } from '../../shared/exercises.ts';
import { LAB_ROOT, missing, run, wsExists, wsText, wsYaml } from './workspace.ts';

export type Check = () => string | null;

// ── Lecture du dépôt du lab ─────────────────────────────────────────────────

/** Un fichier du lab, ou `null`. Le chemin ne peut pas sortir de la racine. */
export function labText(rel: string): string | null {
  const full = path.resolve(LAB_ROOT, rel);
  if (full !== LAB_ROOT && !full.startsWith(LAB_ROOT + path.sep)) return null;
  return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf8') : null;
}

export const labExists = (rel: string) => labText(rel) !== null;

/**
 * Le code sans ses commentaires, **en conservant les lignes**.
 *
 * `jsCode()` de repo.ts remplace un commentaire de bloc par une espace, ce qui
 * décale les numéros de ligne : inutilisable ici, où l'emplacement exact d'un
 * sink est justement ce qu'on note.
 */
export function stripComments(raw: string): string {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < raw.length) {
        if (raw[j] === '\\') { j += 2; continue; }
        if (raw[j] === c) { j++; break; }
        j++;
      }
      out += raw.slice(i, j);
      i = j;
      continue;
    }
    if (c === '/' && raw[i + 1] === '/') {
      while (i < raw.length && raw[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && raw[i + 1] === '*') {
      const end = raw.indexOf('*/', i + 2);
      const stop = end < 0 ? raw.length : end + 2;
      // On recopie les sauts de ligne du commentaire : les numéros ne bougent pas.
      out += raw.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

// ── Vérité terrain nº 1 : les routes réellement montées ─────────────────────

export interface AppRoute {
  /** « GET », « POST »… */
  method: string;
  /** Chemin complet, préfixe de montage compris : « /api/invoices/:id ». */
  path: string;
  /** « GET /api/invoices/:id » — la forme attendue dans les livrables. */
  key: string;
  /** L'authentification est-elle exigée par un middleware ? */
  auth: boolean;
  /** La route exige-t-elle en plus le rôle admin ? */
  admin: boolean;
  file: string;
  line: number;
  /** Le texte du gestionnaire, commentaires retirés. Sert aux dérivations. */
  body: string;
}

const METHODS = 'get|post|put|patch|delete';

/** Le texte d'un appel `router.get( … )`, parenthèses équilibrées. */
function callSlice(code: string, at: number): string {
  const open = code.indexOf('(', at);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return code.slice(open, i + 1); }
  }
  return code.slice(open);
}

/**
 * Les routes que `server/index.ts` monte réellement, avec leur authentification.
 *
 * Les routes de plomberie du lab (`/api/lab/*`) sont exclues : elles sont le
 * harnais, pas Novafact. Un livrable qui les cite n'est ni pénalisé ni crédité.
 */
/**
 * Les routes montées par un arbre `server/` donné — le vrai, ou une copie
 * temporaire que le harnais fabrique pour juger un script de dérive.
 */
export function scanRoutesIn(serverDir: string): AppRoute[] {
  const readIn = (rel: string): string | null => {
    const full = path.join(serverDir, rel);
    return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf8') : null;
  };
  const indexRaw = readIn('index.ts');
  if (indexRaw === null) return [];
  const index = stripComments(indexRaw);

  const files = new Map<string, string>();
  for (const m of index.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/(routes\/[\w-]+)\.ts'/g)) {
    for (const name of m[1].split(',').map((s2) => s2.trim()).filter(Boolean)) {
      files.set(name, `${m[2]}.ts`);
    }
  }

  const out: AppRoute[] = [];

  // Les routes déclarées directement sur l'application (santé…).
  for (const m of index.matchAll(new RegExp(`app\\.(${METHODS})\\(\\s*'([^']+)'`, 'g'))) {
    out.push({
      method: m[1].toUpperCase(), path: m[2], key: `${m[1].toUpperCase()} ${m[2]}`,
      auth: false, admin: false, file: 'index.ts', line: lineOf(index, m.index ?? 0),
      body: callSlice(index, m.index ?? 0),
    });
  }

  for (const mount of index.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
    const prefix = mount[1];
    const router = mount[2];
    const file = files.get(router);
    if (!file) continue;
    const raw = readIn(file);
    if (raw === null) continue;
    const code = stripComments(raw);

    const routerAuth = new RegExp(`${router}\\.use\\(\\s*requireUser\\s*\\)`).test(code);
    // Le rôle admin n'est un critère de route que s'il est imposé par un
    // middleware du routeur — pas parce que la chaîne apparaît quelque part.
    const routerAdmin = [...code.matchAll(new RegExp(`${router}\\.use\\(`, 'g'))].some(
      (m) => /role\s*!==\s*'admin'/.test(code.slice(m.index ?? 0, (m.index ?? 0) + 300)),
    );

    const rx = new RegExp(`${router}\\.(${METHODS})\\(\\s*'([^']*)'\\s*(,\\s*requireUser)?`, 'g');
    for (const m of code.matchAll(rx)) {
      const sub = m[2];
      const full = sub === '' || sub === '/' ? prefix : `${prefix}${sub.startsWith('/') ? '' : '/'}${sub}`;
      const method = m[1].toUpperCase();
      out.push({
        method, path: full, key: `${method} ${full}`,
        auth: routerAuth || Boolean(m[3]), admin: routerAdmin,
        file, line: lineOf(code, m.index ?? 0), body: callSlice(code, m.index ?? 0),
      });
    }
  }

  // Une route peut être déclarée deux fois (un middleware de cache, puis le
  // gestionnaire) : c'est une seule route exposée.
  const byKey = new Map<string, AppRoute>();
  for (const r of out) if (!byKey.has(r.key)) byKey.set(r.key, r);
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Les routes de Novafact, avec leur authentification.
 *
 * Les routes de plomberie du lab (`/api/lab/*`) sont exclues : elles sont le
 * harnais, pas Novafact. Un livrable qui les cite n'est ni pénalisé ni crédité.
 */
export function appRoutes(): AppRoute[] {
  return scanRoutesIn(path.join(LAB_ROOT, 'server'))
    .filter((r) => !r.path.startsWith('/api/lab'))
    .map((r) => ({ ...r, file: `server/${r.file}` }));
}

export const routeKeys = () => appRoutes().map((r) => r.key);

// ── Vérité terrain nº 2 : les sinks du code ─────────────────────────────────

export interface CodeSink {
  file: string;
  line: number;
  /** Famille du sink, imposée : c'est le vocabulaire des livrables. */
  kind: string;
}

export const SINK_KINDS = [
  'requete-donnees', 'fusion-objet', 'chemin', 'fichier',
  'requete-sortante', 'regex', 'mail', 'html', 'script-tiers',
] as const;

const SERVER_SINKS: { kind: string; rx: RegExp }[] = [
  { kind: 'requete-donnees', rx: /\bfindOne\s*\(/ },
  { kind: 'fusion-objet', rx: /\b(?:Object\.assign|deepMerge)\s*\([^;]*req\.body/ },
  { kind: 'chemin', rx: /\bpath\.join\s*\(/ },
  { kind: 'fichier', rx: /\bfs\.(?:readFileSync|writeFileSync|existsSync|statSync|createReadStream)\s*\(/ },
  { kind: 'requete-sortante', rx: /(?:^|[^.\w])fetch\s*\(/ },
  // Quantificateur imbriqué dans un littéral d'expression régulière.
  { kind: 'regex', rx: /\/\^?[^/\n]*\([^()\n]*[+*][^()\n]*\)[*+]/ },
  { kind: 'mail', rx: /\bsendMail\s*\(/ },
];

const CLIENT_SINKS: { kind: string; rx: RegExp }[] = [
  { kind: 'html', rx: /dangerouslySetInnerHTML|\.innerHTML\s*=/ },
  { kind: 'script-tiers', rx: /document\.createElement\(\s*['"]script/ },
];

const listFiles = (dir: string, match: RegExp): string[] => {
  const full = path.resolve(LAB_ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => match.test(f)).sort().map((f) => `${dir}/${f}`);
};

/**
 * Les sinks du code de Novafact, recalculés à chaque audit.
 *
 * Aucune liste figée : si une route change de ligne, la vérité terrain suit.
 * C'est ce qui interdit de recopier une réponse au lieu de lire le code.
 */
export function sinks(): CodeSink[] {
  const out: CodeSink[] = [];
  const scan = (file: string, patterns: { kind: string; rx: RegExp }[]) => {
    const raw = labText(file);
    if (raw === null) return;
    const lines = stripComments(raw).split('\n');
    lines.forEach((line, i) => {
      if (/^\s*function\b/.test(line)) return; // une définition n'est pas un appel
      for (const p of patterns) if (p.rx.test(line)) out.push({ file, line: i + 1, kind: p.kind });
    });
  };
  for (const f of listFiles('server/routes', /\.ts$/)) if (!f.endsWith('lab.ts')) scan(f, SERVER_SINKS);
  for (const f of listFiles('src/pages', /\.tsx$/)) scan(f, CLIENT_SINKS);
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

// ── Lecture des livrables ───────────────────────────────────────────────────

export type Doc = Record<string, unknown>;

/** Charge un livrable YAML, ou renvoie la phrase qui dit ce qui cloche. */
export function ws(rel: string): { doc: Doc } | { err: string } {
  const r = wsYaml<Doc>(rel);
  if (r === null) return { err: missing(rel) };
  if ('error' in r) return { err: `le livrable \`workspace/${rel}\` ${r.error}` };
  const v = r.value;
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length === 0) {
    return { err: `le livrable \`workspace/${rel}\` est vide ou n’est pas un document YAML` };
  }
  return { doc: v };
}

export const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') as Doc[] : []);
export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
export const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : str(v) ? [str(v)] : [];
export const uniq = <T>(xs: T[]) => [...new Set(xs)];
/** Au plus trois exemples : un message d'échec se lit, il ne se déroule pas. */
export const few = (xs: string[], n = 3) =>
  xs.slice(0, n).join(', ') + (xs.length > n ? `, … (${xs.length} au total)` : '');

/** Un fichier cité comme preuve doit exister dans le dépôt. */
export const citesExistingFile = (p: string) => p !== '' && !p.includes('..') && labExists(p);

// ── Fixtures embarquées ─────────────────────────────────────────────────────

export function fixture<T = unknown>(rel: string): T | null {
  const raw = labText(`fixtures/${rel}`);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ═══ Les vérifications ══════════════════════════════════════════════════════

const DFD = 'threats/novafact.dfd.yaml';
const STRIDE = 'threats/stride.yaml';
const TREE = 'threats/tenant-breach.deciduous.yaml';
const CHAIN = 'threats/attack-chain.csv';
const LINDDUN = 'threats/linddun.yaml';
const DRIFT = 'scripts/tm-drift.mjs';

const ELEMENT_TYPES = new Set(['actor', 'process', 'store', 'external']);

interface Element { id: string; type: string; boundary: string; raw: Doc }
interface Flow { id: string; from: string; to: string; routes: string[]; authenticated: boolean }

/** Le modèle de flux, relu et normalisé. Renvoie la première incohérence. */
function readModel(doc: Doc): { elements: Element[]; flows: Flow[]; boundaries: Set<string> } | string {
  const boundaries = new Set(arr(doc.boundaries).map((b) => str(b.id)).filter(Boolean));
  if (boundaries.size < 2) return `\`${DFD}\` déclare moins de deux frontières de confiance`;

  const elements: Element[] = [];
  for (const e of arr(doc.elements)) {
    const id = str(e.id);
    const type = str(e.type);
    const boundary = str(e.boundary);
    if (!id) return `un élément de \`${DFD}\` n’a pas d’identifiant`;
    if (!ELEMENT_TYPES.has(type)) return `l’élément « ${id} » a le type « ${type || '?'} », hors de actor/process/store/external`;
    if (!boundaries.has(boundary)) return `l’élément « ${id} » n’est rattaché à aucune frontière déclarée`;
    if (elements.some((x) => x.id === id)) return `l’identifiant d’élément « ${id} » est déclaré deux fois`;
    elements.push({ id, type, boundary, raw: e });
  }
  if (elements.length === 0) return `\`${DFD}\` ne déclare aucun élément`;

  const byId = new Map(elements.map((e) => [e.id, e]));
  const flows: Flow[] = [];
  for (const f of arr(doc.flows)) {
    const id = str(f.id) || `${str(f.from)}→${str(f.to)}`;
    const from = str(f.from);
    const to = str(f.to);
    if (!byId.has(from) || !byId.has(to)) return `le flux « ${id} » relie un élément qui n’est pas déclaré`;
    flows.push({ id, from, to, routes: strs(f.routes), authenticated: f.authenticated === true });
  }
  if (flows.length === 0) return `\`${DFD}\` ne déclare aucun flux`;
  return { elements, flows, boundaries };
}

export const m11Checks: Record<string, Check> = {
  // ── Le DFD qui remonte la bonne menace ────────────────────────────────────

  'dfd-as-code': () => {
    const r = ws(DFD);
    if ('err' in r) return r.err;
    const model = readModel(r.doc);
    if (typeof model === 'string') return model;
    const { elements, flows } = model;
    const byId = new Map(elements.map((e) => [e.id, e]));

    // 1. Cohérence avec le code : les routes montées, toutes, et rien d'autre.
    const routes = appRoutes();
    if (routes.length === 0) return 'les routes de Novafact n’ont pas pu être relues : vérification impossible';
    // Un flux n'est pas une route : c'est un faisceau de routes qui partagent
    // la même source, la même destination et le même niveau de confiance. Ce
    // qui est exigé, c'est qu'aucune route montée ne reste hors du schéma.
    const declared = new Map<string, Flow>();
    for (const f of flows) {
      for (const key of f.routes) {
        if (declared.has(key)) return `la route « ${key} » est portée par deux flux à la fois`;
        declared.set(key, f);
      }
    }
    const known = new Map(routes.map((x) => [x.key, x]));
    const invented = [...declared.keys()].filter((k) => !known.has(k));
    if (invented.length) return `le modèle décrit des routes qui n’existent pas dans server/ : ${few(invented)}`;
    const uncovered = routes.filter((x) => !declared.has(x.key)).map((x) => x.key);
    if (uncovered.length) return `des routes réellement montées ne sont couvertes par aucun flux : ${few(uncovered)}`;
    const lying = routes.filter((x) => declared.get(x.key)!.authenticated !== x.auth).map((x) => x.key);
    if (lying.length) return `le champ authenticated ne correspond pas au middleware du code pour : ${few(lying)}`;
    const notProcess = [...declared.entries()].filter(([, f]) => byId.get(f.to)!.type !== 'process').map(([k]) => k);
    if (notProcess.length) return `une route doit aboutir à un processus, pas à un autre type d’élément : ${few(notProcess)}`;

    // 2. Le moteur de règles. Le modèle entre, les menaces sortent — toujours
    //    les mêmes pour le même modèle. C'est le harnais qui les recalcule :
    //    fabriquer une liste de menaces à la main n'apporte donc rien.
    const anon = flows.filter((f) => !f.authenticated && byId.get(f.from)!.boundary !== byId.get(f.to)!.boundary);
    const stores = elements.filter((e) => e.type === 'store');
    const leaky = stores.filter((e) => e.raw.tenant_scoped === false);
    const clear = stores.filter((e) => e.raw.encrypted === false);
    const metadata = elements.filter((e) => e.raw.metadata_service === true);
    const ssrf = flows.filter(
      (f) => byId.get(f.from)!.raw.client_controlled_url === true && byId.get(f.to)!.raw.metadata_service === true,
    );

    if (metadata.length === 0) {
      return 'aucun élément ne représente le service de métadonnées d’instance : la menace que personne n’avait vue reste invisible';
    }
    if (ssrf.length === 0) {
      return 'aucun flux ne va d’un processus qui joint une URL fournie par le client vers le service de métadonnées : la menace SSRF ne remonte pas';
    }

    // Le drapeau client_controlled_url n'est pas déclaratif : le processus doit
    // servir une route dont le code fait vraiment une requête sortante.
    const outbound = new Set(sinks().filter((s) => s.kind === 'requete-sortante').map((s) => s.file));
    for (const f of ssrf) {
      const served = flows.filter((x) => x.to === f.from).flatMap((x) => x.routes).map((k) => known.get(k)!);
      if (!served.some((x) => x && outbound.has(x.file))) {
        return `le processus « ${f.from} » est déclaré joignant une URL fournie par le client, mais il ne sert aucune route dont le code fait une requête sortante`;
      }
    }

    const anonRoutes = anon.flatMap((f) => f.routes).length;
    if (anon.length === 0 || anonRoutes < routes.filter((x) => !x.auth).length) {
      return `les routes anonymes de Novafact ne sont pas toutes portées par un flux non authentifié franchissant une frontière (${anonRoutes} sur ${routes.filter((x) => !x.auth).length})`;
    }
    if (clear.length === 0 && leaky.length === 0) {
      return 'aucun magasin de données n’est décrit avec son chiffrement au repos (encrypted) ni son cloisonnement par locataire (tenant_scoped)';
    }
    // Le magasin annoncé non cloisonné doit l'être dans le code : c'est le
    // fichier que porte le challenge BOLA du registre.
    if (leaky.length) {
      const bola = exercises.find((e) => e.id === 'bola-invoice');
      const bolaRoutes = bola ? routes.filter((x) => x.file === bola.file).map((x) => x.key) : [];
      const ok = leaky.some((store) => {
        const feeders = flows.filter((x) => x.to === store.id || x.from === store.id).map((x) => [x.from, x.to]).flat();
        return flows.some((x) => feeders.includes(x.to) && x.routes.some((k) => bolaRoutes.includes(k)));
      });
      if (!ok) {
        return 'le magasin déclaré non cloisonné par locataire n’est relié à aucun processus qui sert les routes où le cloisonnement manque vraiment';
      }
    }
    return null;
  },

  // ── STRIDE par élément, sans trou ─────────────────────────────────────────

  'stride-per-element': () => {
    const ref = fixture<{ elements: { id: string; type: string; file?: string }[] }>('m11/stride-elements.json');
    if (!ref) return 'la fixture fixtures/m11/stride-elements.json est absente : vérification impossible';

    const r = ws(STRIDE);
    if ('err' in r) return r.err;

    // La règle STRIDE-par-élément, telle qu'elle s'applique : un flux ne porte
    // pas d'élévation de privilège, un processus porte les six, un magasin
    // quatre, une entité externe deux.
    const APPLICABLE: Record<string, string[]> = {
      actor: ['S', 'R'],
      process: ['S', 'T', 'R', 'I', 'D', 'E'],
      store: ['T', 'R', 'I', 'D'],
      flow: ['T', 'I', 'D'],
    };

    const given = arr(r.doc.elements);
    if (!given.length) return `\`${STRIDE}\` ne contient aucun élément sous la clé « elements »`;

    const byId = new Map<string, Doc>();
    for (const e of given) {
      const id = str(e.id);
      if (!id) return `un élément de \`${STRIDE}\` n’a pas d’identifiant`;
      if (byId.has(id)) return `l’élément « ${id} » apparaît deux fois`;
      byId.set(id, e);
    }

    const missingEl = ref.elements.filter((e) => !byId.has(e.id)).map((e) => e.id);
    if (missingEl.length) return `des éléments du schéma de référence ne sont pas analysés : ${few(missingEl)}`;
    const extra = [...byId.keys()].filter((id) => !ref.elements.some((e) => e.id === id));
    if (extra.length) return `des éléments inventés figurent dans l’analyse : ${few(extra)}`;

    const routes = appRoutes();
    const allTexts: string[] = [];
    let entries = 0;

    for (const refEl of ref.elements) {
      const el = byId.get(refEl.id)!;
      if (str(el.type) !== refEl.type) {
        return `l’élément « ${refEl.id} » est typé « ${str(el.type) || '?'} » alors que c’est un ${refEl.type}`;
      }

      // Anti-recopie : un processus doit désigner le fichier de routeur qu'il
      // représente, et y rattacher une route que `server/index.ts` monte
      // vraiment. Sans ouvrir le code, on ne peut pas remplir ces deux champs.
      if (refEl.type === 'process') {
        const file = str(el.file);
        const served = routes.filter((x) => x.file === file);
        if (!served.length) {
          return `le processus « ${refEl.id} » désigne le fichier « ${file || '(vide)'} », d’où aucune route n’est montée`;
        }
        if (file !== refEl.file) {
          return `le processus « ${refEl.id} » désigne ${file} alors qu’il représente ${refEl.file}`;
        }
        const example = str(el.route);
        if (!served.some((x) => x.key === example)) {
          return `le processus « ${refEl.id} » cite la route « ${example || '(vide)'} », qui n’est pas montée depuis ${file}`;
        }
      }

      const applicable = APPLICABLE[refEl.type];
      const threats = arr(el.threats);
      const cats = threats.map((t) => str(t.category).toUpperCase());
      const hole = applicable.filter((c) => !cats.includes(c));
      if (hole.length) return `l’élément « ${refEl.id} » (${refEl.type}) n’a pas de menace pour la catégorie ${hole.join(', ')}`;
      const outOfScope = uniq(cats.filter((c) => !applicable.includes(c)));
      if (outOfScope.length) {
        return `l’élément « ${refEl.id} » (${refEl.type}) porte la catégorie ${outOfScope.join(', ')}, qui ne s’applique pas à ce type d’élément`;
      }
      if (cats.length !== uniq(cats).length) return `l’élément « ${refEl.id} » répète une catégorie STRIDE`;

      for (const t of threats) {
        entries++;
        const text = str(t.threat);
        const mitigation = str(t.mitigation);
        const control = str(t.control);
        if (text.length < 15) return `la menace ${str(t.category)} de « ${refEl.id} » n’est pas décrite`;
        if (mitigation.length < 10) return `la menace ${str(t.category)} de « ${refEl.id} » n’a pas de mitigation`;
        if (!citesExistingFile(control)) {
          return `la menace ${str(t.category)} de « ${refEl.id} » cite le contrôle « ${control || '(vide)'} », qui n’est pas un fichier du dépôt`;
        }
        allTexts.push(text.toLowerCase());
      }
    }

    // Une réponse maximaliste — la même phrase recopiée partout — ne passe pas.
    if (uniq(allTexts).length < Math.ceil(entries * 0.8)) {
      return `${entries - uniq(allTexts).length} menaces sur ${entries} reprennent mot pour mot la description d’une autre : l’analyse est recopiée`;
    }
    return null;
  },

  // ── L'arbre d'attaque coupé ───────────────────────────────────────────────

  'attack-tree': () => {
    const r = ws(TREE);
    if ('err' in r) return r.err;
    const doc = r.doc;

    const facts = arr(doc.facts);
    const attacks = arr(doc.attacks);
    const goals = arr(doc.goals);
    const mitigations = arr(doc.mitigations);
    if (!facts.length) return `\`${TREE}\` ne déclare aucun fait (clé « facts »)`;
    if (attacks.length < 4) return `\`${TREE}\` ne déclare que ${attacks.length} attaques : l’arbre ne montre pas les chemins`;
    if (!goals.length) return `\`${TREE}\` ne déclare aucun objectif (clé « goals »)`;
    if (!mitigations.length) return `\`${TREE}\` ne déclare aucune mitigation`;

    const nodes = new Map<string, { kind: string; from: string[]; raw: Doc }>();
    for (const [kind, list] of [['fact', facts], ['attack', attacks], ['goal', goals]] as const) {
      for (const n of list) {
        const id = str(n.id);
        if (!id) return `un nœud « ${kind} » de \`${TREE}\` n’a pas d’identifiant`;
        if (nodes.has(id)) return `l’identifiant « ${id} » est utilisé par deux nœuds`;
        nodes.set(id, { kind, from: strs(n.from), raw: n });
      }
    }
    for (const [id, n] of nodes) {
      if (n.kind === 'fact' && n.from.length) return `le fait « ${id} » a des prédécesseurs : un fait est une racine`;
      const dangling = n.from.filter((f) => !nodes.has(f));
      if (dangling.length) return `le nœud « ${id} » part de « ${dangling[0] as string} », qui n’est déclaré nulle part`;
    }

    // Acyclicité — un arbre d'attaque qui boucle ne se raisonne pas.
    const state = new Map<string, number>();
    const visit = (id: string): string | null => {
      if (state.get(id) === 1) return id;
      if (state.get(id) === 2) return null;
      state.set(id, 1);
      for (const p of nodes.get(id)!.from) {
        const cyc = visit(p);
        if (cyc) return cyc;
      }
      state.set(id, 2);
      return null;
    };
    for (const id of nodes.keys()) {
      const cyc = visit(id);
      if (cyc) return `le graphe contient un cycle qui passe par « ${cyc} »`;
    }

    // Chaque mitigation doit être *réellement implémentée* : elle cite un
    // fichier du corrigé et une preuve textuelle qu'on y retrouve.
    const cut = new Set<string>();
    const live = new Map(exercises.map((e) => [e.id, e]));
    for (const m of mitigations) {
      const id = str(m.id) || '(sans identifiant)';
      const targets = strs(m.mitigates);
      if (!targets.length) return `la mitigation « ${id} » ne dit pas quel nœud elle coupe (clé « mitigates »)`;
      const unknownT = targets.filter((t) => !nodes.has(t));
      if (unknownT.length) return `la mitigation « ${id} » coupe « ${unknownT[0] as string} », qui n’est pas un nœud de l’arbre`;
      const file = str(m.implemented_by);
      if (!file.startsWith('solutions/')) {
        return `la mitigation « ${id} » doit citer dans « implemented_by » le fichier du corrigé qui l’implémente (sous solutions/)`;
      }
      const code = labText(file);
      if (code === null) return `la mitigation « ${id} » cite « ${file} », qui n’existe pas`;
      const evidence = str(m.evidence);
      if (evidence.length < 8) return `la mitigation « ${id} » n’apporte aucune preuve (clé « evidence » : un fragment du code qui l’implémente)`;
      if (!stripComments(code).includes(evidence)) {
        return `la preuve de la mitigation « ${id} » ne se retrouve pas dans ${file} : la mitigation est déclarée, pas implémentée`;
      }
      for (const t of targets) cut.add(t);
    }

    // Une attaque peut être rattachée à un challenge jouable : si elle l'est,
    // la mitigation qui la coupe doit corriger le fichier de ce challenge.
    const tied = attacks.filter((a) => str(a.challenge));
    const badRef = tied.filter((a) => !live.has(str(a.challenge))).map((a) => str(a.challenge));
    if (badRef.length) return `des attaques citent un challenge inconnu du registre : ${few(badRef)}`;
    if (tied.length < 3) return `seules ${tied.length} attaques sont rattachées à un challenge jouable du lab (clé « challenge ») : il en faut au moins 3`;
    for (const a of tied) {
      const id = str(a.id);
      const ex = live.get(str(a.challenge))!;
      const cutters = mitigations.filter((m) => strs(m.mitigates).includes(id));
      if (!cutters.length) continue; // le chemin sera signalé plus bas
      if (!cutters.some((m) => str(m.implemented_by) === `solutions/${ex.file}`)) {
        return `l’attaque « ${id} » est rattachée au challenge ${ex.id}, mais aucune de ses mitigations ne corrige solutions/${ex.file}`;
      }
    }

    // La propriété qui compte : tout chemin d'un fait vers un objectif traverse
    // au moins une mitigation implémentée. On retire les nœuds coupés, et on
    // regarde si un objectif reste atteignable.
    const open = (id: string, seen = new Set<string>()): string[] | null => {
      if (cut.has(id) || seen.has(id)) return null;
      seen.add(id);
      const n = nodes.get(id)!;
      if (n.kind === 'fact') return [id];
      for (const p of n.from) {
        const via = open(p, seen);
        if (via) return [...via, id];
      }
      return null;
    };
    for (const g of goals) {
      const id = str(g.id);
      const alive = open(id);
      if (alive) return `l’objectif « ${id} » reste atteignable : ${alive.join(' → ')} ne traverse aucune mitigation implémentée`;
    }
    // …et l'inverse : un objectif qu'aucun fait n'atteint, même sans mitigation,
    // est un objectif qu'on s'est contenté de déclarer.
    const reach = (id: string, seen = new Set<string>()): boolean => {
      if (seen.has(id)) return false;
      seen.add(id);
      const n = nodes.get(id)!;
      if (n.kind === 'fact') return true;
      return n.from.some((p) => reach(p, seen));
    };
    for (const g of goals) {
      if (!reach(str(g.id))) return `l’objectif « ${str(g.id)} » n’est relié à aucun fait : l’arbre ne dit pas comment on y arrive`;
    }
    return null;
  },

  // ── Du CWE à la technique ATT&CK ──────────────────────────────────────────

  'cwe-capec-attack': () => {
    const data = fixture<{
      capec: Record<string, { name: string; cwe: string[]; attack: string[] }>;
      attack: Record<string, { name: string }>;
    }>('m11/mitre.json');
    if (!data) return 'la fixture fixtures/m11/mitre.json est absente : vérification impossible';

    const raw = wsText(CHAIN);
    if (raw === null) return missing(CHAIN);
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return `le livrable \`workspace/${CHAIN}\` est vide`;

    const header = lines[0].split(',').map((c) => c.trim().toLowerCase());
    const need = ['challenge', 'cwe', 'capec', 'attack', 'attack_name'];
    const absent = need.filter((c) => !header.includes(c));
    if (absent.length) return `l’en-tête du CSV n’a pas les colonnes ${absent.join(', ')}`;
    const col = (row: string[], name: string) => (row[header.indexOf(name)] ?? '').trim();

    const rows = lines.slice(1).map((l) => l.split(','));
    if (rows.length !== 5) return `le CSV contient ${rows.length} lignes de données au lieu des 5 demandées`;

    const live = new Map(exercises.map((e) => [e.id, e]));
    const seen = new Set<string>();
    const modules = new Set<string>();

    for (const row of rows) {
      const id = col(row, 'challenge');
      const ex = live.get(id);
      if (!ex) return `la ligne « ${id || '(vide)'} » ne désigne pas un challenge jouable du lab`;
      if (seen.has(id)) return `le challenge ${id} apparaît deux fois : il faut cinq challenges distincts`;
      seen.add(id);
      modules.add(ex.module);

      const cwe = col(row, 'cwe').toUpperCase();
      if (cwe !== ex.cwe) return `le challenge ${id} porte ${ex.cwe} dans le registre, pas ${cwe || '(vide)'}`;

      const capecId = col(row, 'capec').toUpperCase();
      const capec = data.capec[capecId];
      if (!capec) return `${capecId || '(vide)'} n’existe pas dans les correspondances embarquées`;
      if (!capec.cwe.includes(cwe)) return `${capecId} n’est pas rattaché à ${cwe} : le premier maillon de la chaîne est faux`;

      const tech = col(row, 'attack').toUpperCase();
      if (!capec.attack.includes(tech)) return `${capecId} ne se projette pas sur ${tech || '(vide)'} : le second maillon de la chaîne est faux`;
      const name = col(row, 'attack_name');
      if (name.toLowerCase() !== (data.attack[tech]?.name ?? '').toLowerCase()) {
        return `le nom donné pour ${tech} (« ${name || '(vide)'} ») n’est pas celui de la technique`;
      }
    }
    if (modules.size < 3) return `les cinq challenges viennent de ${modules.size} modules : il en faut au moins 3 pour que la chaîne serve à quelque chose`;
    return null;
  },

  // ── LINDDUN sur le parcours de facturation ────────────────────────────────

  'linddun-privacy': () => {
    const ref = fixture<{ journey: string[]; collections: Record<string, string[]> }>('m11/data-classification.json');
    if (!ref) return 'la fixture fixtures/m11/data-classification.json est absente : vérification impossible';

    const r = ws(LINDDUN);
    if ('err' in r) return r.err;
    const CATEGORIES = new Set(['L', 'I', 'NR', 'D', 'DD', 'U', 'NC']);

    const flows = arr(r.doc.flows);
    if (!flows.length) return `\`${LINDDUN}\` ne contient aucun flux sous la clé « flows »`;

    // Le périmètre n'est pas une liste : il se déduit du code. Un flux fait
    // partie du parcours de facturation s'il touche une des collections du
    // parcours, et les données personnelles qu'il transporte sont celles que la
    // classification attache à ces collections.
    const routes = appRoutes();
    const touched = (body: string) => ref.journey.filter((c) => body.includes(c));
    const scope = new Map<string, string[]>();
    for (const x of routes) {
      const cols = touched(x.body);
      if (!cols.length) continue;
      const all = uniq(Object.keys(ref.collections).filter((c) => x.body.includes(c)).flatMap((c) => ref.collections[c]));
      if (all.length) scope.set(x.key, all.sort());
    }
    if (!scope.size) return 'le parcours de facturation n’a pas pu être relu dans le code : vérification impossible';

    const seen = new Set<string>();
    const measures: string[] = [];

    for (const f of flows) {
      const key = str(f.route);
      if (!routes.some((x) => x.key === key)) return `le flux « ${key || '(vide)'} » ne correspond à aucune route montée`;
      if (seen.has(key)) return `la route ${key} est analysée deux fois`;
      seen.add(key);

      const expected = scope.get(key);
      if (!expected) return `la route ${key} ne touche aucune donnée personnelle du parcours de facturation : elle n’a rien à faire dans cette analyse`;
      const claimed = strs(f.personal_data).sort();
      if (claimed.join('|') !== expected.join('|')) {
        return `les données personnelles de ${key} sont ${claimed.join(', ') || '(aucune)'} alors que son code en manipule ${expected.join(', ')}`;
      }

      const cats = strs(f.categories).map((c) => c.toUpperCase());
      if (!cats.length) return `le flux ${key} n’est rattaché à aucune catégorie LINDDUN`;
      const bogus = cats.filter((c) => !CATEGORIES.has(c));
      if (bogus.length) return `« ${bogus[0] as string} » n’est pas une des sept catégories LINDDUN (L, I, NR, D, DD, U, NC)`;
      if (cats.length !== uniq(cats).length) return `le flux ${key} répète une catégorie`;

      const measure = str(f.measure);
      if (measure.length < 15) return `le flux ${key} n’a pas de mesure`;
      const control = str(f.control);
      if (!citesExistingFile(control)) {
        return `la mesure de ${key} cite « ${control || '(vide)'} », qui n’est pas un fichier du dépôt`;
      }
      measures.push(measure.toLowerCase());
    }

    const uncovered = [...scope.keys()].filter((k) => !seen.has(k));
    if (uncovered.length) return `des flux transportent des données personnelles et ne sont pas analysés : ${few(uncovered)}`;
    if (uniq(measures).length < measures.length) return 'la même mesure est recopiée sur plusieurs flux : l’analyse est maximaliste, pas conduite';
    return null;
  },

  // ── Le modèle qui bloque la PR ────────────────────────────────────────────

  'tm-drift-ci': () => {
    if (!wsExists(DRIFT)) return missing(DRIFT);
    const script = wsText(DRIFT) ?? '';
    if (script.trim().length < 50) return `le livrable \`workspace/${DRIFT}\` est vide`;

    const routes = appRoutes();
    if (!routes.length) return 'les routes de Novafact n’ont pas pu être relues : vérification impossible';

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-drift-'));
    try {
      // Un arbre de référence, recopié depuis le lab.
      const treeDir = path.join(tmp, 'server');
      fs.mkdirSync(path.join(treeDir, 'routes'), { recursive: true });
      fs.copyFileSync(path.join(LAB_ROOT, 'server/index.ts'), path.join(treeDir, 'index.ts'));
      for (const f of fs.readdirSync(path.join(LAB_ROOT, 'server/routes'))) {
        fs.copyFileSync(path.join(LAB_ROOT, 'server/routes', f), path.join(treeDir, 'routes', f));
      }

      // Le modèle, aligné sur cet arbre — toutes les routes qu'il monte, sans
      // exception : le contrat du script est « ce dossier », pas « Novafact ».
      const all = scanRoutesIn(treeDir).map((x) => x.key);
      const model = path.join(tmp, 'model.json');
      fs.writeFileSync(model, JSON.stringify({ routes: all }, null, 2));
      // …et un modèle amputé d'une route, pour qu'un script qui répond toujours
      // « pas de dérive » se fasse prendre.
      const truncated = path.join(tmp, 'model-truncated.json');
      const dropped = all[all.length - 1];
      fs.writeFileSync(truncated, JSON.stringify({ routes: all.slice(0, -1) }, null, 2));

      // Une route fantôme, dont le nom change à chaque audit : impossible à
      // coder en dur dans le script.
      const tag = Math.random().toString(36).slice(2, 8);
      const ghostPath = `/api/ghost-${tag}`;
      const drifted = path.join(tmp, 'drifted');
      fs.cpSync(treeDir, path.join(drifted, 'server'), { recursive: true });
      fs.writeFileSync(
        path.join(drifted, 'server/routes/ghost.ts'),
        `import { Router } from 'express';\nexport const ghostRoutes = Router();\nghostRoutes.get('/', (_req, res) => res.json({ ok: true }));\n`,
      );
      const idx = path.join(drifted, 'server/index.ts');
      fs.writeFileSync(
        idx,
        fs.readFileSync(idx, 'utf8')
          .replace("import { labRoutes } from './routes/lab.ts';", "import { labRoutes } from './routes/lab.ts';\nimport { ghostRoutes } from './routes/ghost.ts';")
          .replace("app.use('/api/lab', labRoutes);", `app.use('/api/lab', labRoutes);\napp.use('${ghostPath}', ghostRoutes);`),
      );

      const call = (dir: string, modelFile: string) =>
        run(process.execPath, [path.join(LAB_ROOT, 'workspace', DRIFT), dir, modelFile], { timeoutMs: 20_000 });

      const clean = call(path.join(tmp, 'server'), model);
      if (clean.timedOut) return 'le script ne rend pas la main sur un arbre sans dérive (délai dépassé)';
      if (!clean.ok) {
        return `le script signale une dérive alors que le modèle couvre toutes les routes : ${(clean.output.trim().split('\n').pop() ?? '').slice(0, 160)}`;
      }

      const ghost = call(path.join(drifted, 'server'), model);
      if (ghost.ok) return `le script laisse passer la route ${ghostPath} GET, qui n’est dans aucun modèle : la PR ne serait pas bloquée`;
      if (!ghost.output.includes(ghostPath)) {
        return `le script bloque bien, mais sans nommer la route en cause (${ghostPath} n’apparaît pas dans sa sortie)`;
      }

      const hole = call(path.join(tmp, 'server'), truncated);
      if (hole.ok) return `le script laisse passer un modèle qui a oublié ${dropped} : il ne compare rien`;
      return null;
    } catch (err) {
      return `le script n’a pas pu être exécuté : ${(err as Error).message}`;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },

  // ── Modéliser l'agent, la chaîne et le poste ──────────────────────────────

  'tm-ai-supply-dev': () => {
    const files = { agent: 'threats/agent.yaml', supply: 'threats/supply-chain.yaml', dev: 'threats/workstation.yaml' };

    const docs: Record<string, Doc> = {};
    for (const rel of Object.values(files)) {
      const r = ws(rel);
      if ('err' in r) return r.err;
      docs[rel] = r.doc;
    }

    const threatsOf = (rel: string) => arr(docs[rel].threats);
    for (const rel of Object.values(files)) {
      const list = threatsOf(rel);
      if (list.length < 3) return `\`${rel}\` ne décrit que ${list.length} menaces : il en faut au moins 3`;
      for (const t of list) {
        if (str(t.threat).length < 15) return `une menace de \`${rel}\` n’est pas décrite`;
        if (!str(t.boundary)) return `une menace de \`${rel}\` ne dit pas quelle frontière de confiance elle franchit`;
        const control = str(t.control);
        if (!citesExistingFile(control)) {
          return `une menace de \`${rel}\` cite le contrôle « ${control || '(vide)'} », qui n’est pas un fichier du dépôt`;
        }
      }
    }

    // 1. L'agent : chaque outil réellement exposé par l'assistant est modélisé.
    const assistant = stripComments(labText('server/routes/assistant.ts') ?? '');
    const tools = uniq([...assistant.matchAll(/tool:\s*'([a-z_]+)'/g)].map((m) => m[1]));
    if (!tools.length) return 'les outils de l’assistant n’ont pas pu être relus dans le code : vérification impossible';
    const modelled = strs(docs[files.agent].tools);
    const missingTools = tools.filter((t) => !modelled.includes(t));
    if (missingTools.length) return `des outils de l’assistant ne sont pas modélisés dans \`${files.agent}\` : ${few(missingTools)}`;
    const inventedTools = modelled.filter((t) => !tools.includes(t));
    if (inventedTools.length) return `\`${files.agent}\` modélise des outils que l’assistant n’a pas : ${few(inventedTools)}`;

    // 2. La chaîne : chaque job de chaque workflow de la fixture apparaît.
    const jobs: string[] = [];
    const wfDir = path.join(LAB_ROOT, 'novafact/.github/workflows');
    if (!fs.existsSync(wfDir)) return 'le dépôt fixture novafact/ est absent : vérification impossible';
    for (const file of fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f)).sort()) {
      const raw = fs.readFileSync(path.join(wfDir, file), 'utf8');
      const inJobs = raw.split(/^jobs:\s*$/m)[1] ?? '';
      for (const m of inJobs.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)) jobs.push(`${file}:${m[1]}`);
    }
    const steps = strs(docs[files.supply].pipeline);
    const missingJobs = jobs.filter((j) => !steps.includes(j));
    if (missingJobs.length) return `des étapes du pipeline ne sont pas modélisées dans \`${files.supply}\` : ${few(missingJobs)}`;
    const inventedJobs = steps.filter((j) => !jobs.includes(j));
    if (inventedJobs.length) return `\`${files.supply}\` modélise des étapes qui n’existent pas : ${few(inventedJobs)}`;

    // 3. Le poste : chaque secret joignable depuis un poste de développement.
    const secrets = new Set<string>();
    for (const file of fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f))) {
      const raw = fs.readFileSync(path.join(wfDir, file), 'utf8');
      for (const m of raw.matchAll(/secrets\.([A-Z0-9_]+)/g)) secrets.add(m[1]);
    }
    for (const m of (labText('novafact/.npmrc') ?? '').matchAll(/\$\{?([A-Z0-9_]+)\}?/g)) secrets.add(m[1]);
    if (!secrets.size) return 'aucun secret n’a pu être relu dans la fixture : vérification impossible';
    const listed = strs(docs[files.dev].secrets);
    const missingSecrets = [...secrets].filter((s) => !listed.includes(s));
    if (missingSecrets.length) return `des secrets joignables depuis un poste ne sont pas listés dans \`${files.dev}\` : ${few(missingSecrets)}`;
    const inventedSecrets = listed.filter((s) => !secrets.has(s));
    if (inventedSecrets.length) return `\`${files.dev}\` liste des secrets qui n’existent nulle part : ${few(inventedSecrets)}`;

    // Trois modèles, trois surfaces : recopier le premier dans les deux autres
    // ne produit pas « les menaces que les deux autres ne couvrent pas ».
    const sets = Object.values(files).map((rel) => new Set(threatsOf(rel).map((t) => str(t.threat).toLowerCase())));
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const shared = [...sets[i]].filter((t) => sets[j].has(t));
        if (shared.length) return `la même menace figure dans deux des trois modèles : « ${shared[0].slice(0, 60)}… »`;
      }
    }
    return null;
  },
};
