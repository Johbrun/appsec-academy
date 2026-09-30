// Vérifications des challenges M5 · Gestion des vulnérabilités.
//
// Tous les challenges de ce module sont de type « artifact » : l'apprenant
// PRODUIT un fichier dans `workspace/`, et c'est ce fichier qui est jugé. Le
// contrat est celui des autres modules — `null` quand c'est bon, sinon une
// phrase qui nomme ce qui manque.
//
// Quatre motifs de correction, et aucun autre n'est utilisé ici :
//
//   1. **différentiel** — le script produit est exécuté sur un jeu que le
//      harnais fabrique au moment du contrôle, en plus du jeu publié. Une
//      réponse codée en dur passe le premier et échoue le second.
//   2. **schéma** — ajv, avec des énumérations fermées et des conditionnels
//      (un « non affecté » exige une justification prise dans une liste close).
//   3. **recalcul / lookup** — le harnais refait le calcul, ou relit la ligne
//      de la table de décision qu'il embarque.
//   4. **confrontation au code** — une chaîne d'appel déclarée doit exister
//      réellement dans `server/`, du point d'entrée monté jusqu'au sink.
//
// Ce qui relève du jugement n'est pas noté, et chaque énoncé le dit : la
// justification écrite dans un CSV, le choix d'un point de décision SSVC, la
// prose d'un `impact_statement`. Seule leur conséquence calculable l'est.
//
// Deux challenges spécifiés restent `planned` :
//   · `cvss4-vector` — aucun calculateur CVSS 4.0 n'est installé, et la table
//     de macro-vecteurs ne se réécrit pas de mémoire sans risque d'erreur ;
//   · `regression-not-poc` — il exige le double passage, que `workspace.ts`
//     explique ne pas être outillé.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  LAB_ROOT,
  missing,
  run,
  wsExists,
  wsJson,
  wsPath,
  wsText,
  wsYaml,
} from './workspace.ts';
import type { Check } from './m14.ts';

const requireCjs = createRequire(import.meta.url);
const ts = requireCjs('typescript') as typeof import('typescript');

// ── Fixtures ────────────────────────────────────────────────────────────────

export const FIXTURES = path.join(LAB_ROOT, 'fixtures');

export function fixText(rel: string): string | null {
  const full = path.resolve(FIXTURES, rel);
  if (!full.startsWith(FIXTURES + path.sep)) return null;
  return fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf8') : null;
}

export function fixJson<T = unknown>(rel: string): T {
  const raw = fixText(rel);
  if (raw === null) throw new Error(`fixture manquante : fixtures/${rel}`);
  return JSON.parse(raw) as T;
}

// ── Schémas ─────────────────────────────────────────────────────────────────

const ajv = addFormats(new Ajv({ allErrors: true, strict: false }));

// ajv refuse de compiler deux fois un schéma qui porte un `$id`. Les
// vérifications étant rejouées à chaque audit, on garde les validateurs.
const validateurs = new Map<string, import('ajv').ValidateFunction>();

/** `null` si le document respecte le schéma, sinon les écarts, en français. */
export function valideSchema(schema: object, data: unknown, quoi: string): string | null {
  const empreinte = JSON.stringify(schema);
  let valide = validateurs.get(empreinte);
  if (!valide) {
    valide = ajv.compile(schema);
    validateurs.set(empreinte, valide);
  }
  if (valide(data)) return null;
  const ecarts = (valide.errors ?? []).slice(0, 4).map((e) => {
    const ou = e.instancePath === '' ? 'à la racine' : `en ${e.instancePath}`;
    const permis = (e.params as { allowedValues?: unknown[]; additionalProperty?: string });
    if (permis.additionalProperty) return `${ou} : la clé « ${permis.additionalProperty} » n’est pas permise`;
    if (permis.allowedValues) return `${ou} : ${e.message} (${permis.allowedValues.join(', ')})`;
    return `${ou} : ${e.message}`;
  });
  return `${quoi} ne respecte pas le schéma — ${ecarts.join(' · ')}`;
}

// ── Exécution du code de l'apprenant ────────────────────────────────────────

export interface Sortie {
  erreur: string | null;
  valeur: unknown;
}

/**
 * Lance un script de l'espace de travail et relit sa sortie standard comme du
 * JSON. Le script tourne depuis la racine du lab : ses `import` de
 * bibliothèques (js-yaml, ajv…) se résolvent donc comme partout ailleurs.
 */
export function captureJson(script: string, args: string[], etiquette: string, timeoutMs = 60_000): Sortie {
  const capture = path.join(FIXTURES, 'm05/runners/capture.mjs');

  return dansUnDossierTemporaire('sortie', (dir) => {
    const fichier = path.join(dir, 'sortie.txt');
    const r = run(process.execPath, [capture, fichier, script, ...args], { cwd: LAB_ROOT, timeoutMs });
    if (r.timedOut) return { erreur: `${etiquette} ne s’est pas terminé à temps`, valeur: null };
    let verdict: { ok: boolean; erreur?: string; expire?: boolean };
    try {
      verdict = JSON.parse(r.output.trim().split('\n').slice(-1)[0] ?? '');
    } catch {
      return { erreur: `l’exécuteur n’a pas pu lancer ${etiquette} : ${premiereLigne(r.output)}`, valeur: null };
    }
    if (!verdict.ok) {
      return {
        erreur: verdict.expire
          ? `${etiquette} ne s’est pas terminé à temps`
          : `${etiquette} est sorti en erreur : ${verdict.erreur}`,
        valeur: null,
      };
    }
    const texte = fs.readFileSync(fichier, 'utf8').trim();
    if (texte === '') return { erreur: `${etiquette} n’a rien écrit sur la sortie standard`, valeur: null };
    // Un script bavard reste acceptable tant que la dernière ligne est le JSON.
    for (const candidat of [texte, texte.split('\n').filter(Boolean).slice(-1)[0] ?? '']) {
      try {
        return { erreur: null, valeur: JSON.parse(candidat) };
      } catch {
        /* on tente la ligne suivante */
      }
    }
    return { erreur: `la sortie de ${etiquette} n’est pas du JSON : ${premiereLigne(texte)}`, valeur: null };
  });
}

export function executeJson(relScript: string, args: string[], timeoutMs = 60_000): Sortie {
  const full = wsPath(relScript);
  if (full === null) return { erreur: `le chemin ${relScript} sort de l’espace de travail`, valeur: null };
  return captureJson(full, args, `\`workspace/${relScript}\``, timeoutMs);
}

const premiereLigne = (s: string) => (s.split('\n').find((l) => l.trim() !== '') ?? '').trim().slice(0, 180);

/** Un dossier temporaire, supprimé quoi qu'il arrive. */
export function dansUnDossierTemporaire<T>(prefixe: string, fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `novafact-${prefixe}-`));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── Petits utilitaires ──────────────────────────────────────────────────────

/** Le livrable, ou la raison de son absence. */
export function livrable(rel: string): { texte: string } | { raison: string } {
  if (!wsExists(rel)) return { raison: missing(rel) };
  const texte = wsText(rel) ?? '';
  if (texte.trim() === '') return { raison: `le livrable \`workspace/${rel}\` est vide` };
  return { texte };
}

export function lisCsv(texte: string): string[][] {
  const lignes: string[][] = [];
  let champ = '';
  let ligne: string[] = [];
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; continue; }
      if (c === '"') { guillemets = false; continue; }
      champ += c;
      continue;
    }
    if (c === '"') { guillemets = true; continue; }
    if (c === ',') { ligne.push(champ); champ = ''; continue; }
    if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; continue; }
    if (c === '\r') continue;
    champ += c;
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.filter((l) => l.some((v) => v.trim() !== ''));
}

const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
      : JSON.stringify(v);

export const memeValeur = (a: unknown, b: unknown) => stable(a) === stable(b);

// ════════════════════════════════════════════════════════════════════════════
//  Analyse du code de `server/` : quelles fonctions sont réellement atteintes
// ════════════════════════════════════════════════════════════════════════════
//
// C'est la vérité terrain de `reachability-ast` et de `vex-not-affected`. Elle
// est RECALCULÉE à chaque audit plutôt que figée dans une table : le code du
// lab bouge, et une vérité terrain périmée ferait échouer un travail correct.

const METHODES_ROUTE = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'options', 'head', 'use']);

interface Fichier {
  rel: string;
  sf: import('typescript').SourceFile;
  /** nom → nœud du corps de la fonction. */
  fonctions: Map<string, import('typescript').Node>;
  /** nom local importé → chemin relatif du fichier cible. */
  imports: Map<string, string>;
  /** tous les identifiants du fichier, pour dire si un symbole existe. */
  identifiants: Set<string>;
}

export interface Route {
  methode: string;
  chemin: string;
  fichier: string;
  corps: import('typescript').Node;
  /** Le nom de la fonction enregistrée, quand le gestionnaire est nommé. */
  symbole?: string;
}

export interface Symbole {
  fichier: string;
  fonction: string;
}

let cacheAnalyse: Analyse | null = null;
let cacheEmpreinte = '';

export interface Analyse {
  fichiers: Map<string, Fichier>;
  routes: Route[];
  /** Le symbole est-il défini quelque part dans `server/` ? */
  existe(s: Symbole): boolean;
  /** Le symbole apparaît-il, sous une forme ou une autre, dans son fichier ? */
  cite(fichier: string, nom: string): boolean;
  /** Un chemin d'appel depuis une route montée, ou null. */
  chemin(s: Symbole): string[] | null;
  /** `a` appelle-t-il `b` ? (résolution locale puis par import) */
  appelle(a: Symbole, b: Symbole): boolean;
  /** Les fonctions appelées depuis un nœud, résolues. */
  appelsDepuis(fichier: string, noeud: import('typescript').Node): Symbole[];
}

function listeTs(dir: string, racine: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listeTs(full, racine, out);
    else if (/\.tsx?$/.test(e.name)) out.push(path.relative(racine, full).split(path.sep).join('/'));
  }
  return out;
}

function empreinteServer(rels: string[]): string {
  const h = crypto.createHash('sha1');
  for (const rel of rels) {
    const st = fs.statSync(path.join(LAB_ROOT, rel));
    h.update(`${rel}:${st.size}:${st.mtimeMs}`);
  }
  return h.digest('hex');
}

export function analyseServeur(): Analyse {
  const rels = listeTs(path.join(LAB_ROOT, 'server'), LAB_ROOT);
  const empreinte = empreinteServer(rels);
  if (cacheAnalyse && cacheEmpreinte === empreinte) return cacheAnalyse;

  const fichiers = new Map<string, Fichier>();
  for (const rel of rels) {
    const sf = ts.createSourceFile(rel, fs.readFileSync(path.join(LAB_ROOT, rel), 'utf8'), ts.ScriptTarget.ES2022, true);
    const fonctions = new Map<string, import('typescript').Node>();
    const imports = new Map<string, string>();
    const identifiants = new Set<string>();

    const visite = (n: import('typescript').Node): void => {
      if (ts.isIdentifier(n)) identifiants.add(n.text);
      if (ts.isFunctionDeclaration(n) && n.name) fonctions.set(n.name.text, n);
      if (ts.isVariableStatement(n)) {
        for (const d of n.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || !d.initializer) continue;
          if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) {
            fonctions.set(d.name.text, d.initializer);
          }
        }
      }
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        const spec = n.moduleSpecifier.text;
        if (spec.startsWith('.')) {
          const cible = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
          const clause = n.importClause;
          if (clause?.name) imports.set(clause.name.text, cible);
          if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const el of clause.namedBindings.elements) imports.set(el.name.text, cible);
          }
        }
      }
      ts.forEachChild(n, visite);
    };
    visite(sf);
    fichiers.set(rel, { rel, sf, fonctions, imports, identifiants });
  }

  // ── Table des routes : ce que `server/index.ts` monte, et ce que chaque
  //    routeur enregistre dessous.
  const routes: Route[] = [];
  const index = fichiers.get('server/index.ts');
  const normalise = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

  /** Le fichier visé par un nom importé, s'il est local au serveur. */
  const fichierDe = (f: Fichier, nom: string): Fichier | undefined => {
    const cible = f.imports.get(nom);
    if (!cible) return undefined;
    return fichiers.get(cible) ?? fichiers.get(`${cible}.ts`);
  };

  /**
   * Un intergiciel passé par référence — `routes.use(requireUser)` — est un
   * point d'entrée au même titre qu'un gestionnaire écrit sur place. L'ignorer
   * ferait déclarer « jamais appelée » une fonction qui s'exécute à chaque
   * requête : une sous-approximation est ici une fausse vérité terrain.
   */
  const gestionnaireParNom = (f: Fichier, nom: string): { fichier: string; corps: import('typescript').Node } | null => {
    if (f.fonctions.has(nom)) return { fichier: f.rel, corps: f.fonctions.get(nom)! };
    const cible = fichierDe(f, nom);
    if (cible?.fonctions.has(nom)) return { fichier: cible.rel, corps: cible.fonctions.get(nom)! };
    return null;
  };

  const montes = new Set<string>();

  const enregistrements = (f: Fichier, nomObjet: string, prefixe: string): number => {
    const marque = `${f.rel}|${nomObjet}|${prefixe}`;
    if (montes.has(marque)) return 1;
    montes.add(marque);
    let trouves = 0;
    const visite = (n: import('typescript').Node): void => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const methode = n.expression.name.text;
        const obj = n.expression.expression;
        if (METHODES_ROUTE.has(methode) && ts.isIdentifier(obj) && obj.text === nomObjet) {
          const args = [...n.arguments];
          const chemin = args[0] && ts.isStringLiteral(args[0]) ? args[0].text : '';
          for (const a of args) {
            if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) {
              routes.push({ methode: methode.toUpperCase(), chemin: normalise(prefixe + chemin), fichier: f.rel, corps: a });
              trouves++;
            } else if (ts.isIdentifier(a)) {
              const g = gestionnaireParNom(f, a.text);
              if (g) {
                routes.push({ methode: methode.toUpperCase(), chemin: normalise(prefixe + chemin), fichier: g.fichier, corps: g.corps, symbole: a.text });
                trouves++;
              } else {
                const sousRouteur = fichierDe(f, a.text);
                if (sousRouteur) trouves += enregistrements(sousRouteur, a.text, normalise(prefixe + chemin));
              }
            }
          }
        }
      }
      ts.forEachChild(n, visite);
    };
    visite(f.sf);
    return trouves;
  };

  if (index) {
    // Les montages : app.use('/api/xxx', routeurImporté), et les intergiciels
    // globaux passés par référence.
    const visite = (n: import('typescript').Node): void => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const methode = n.expression.name.text;
        const obj = n.expression.expression;
        if (METHODES_ROUTE.has(methode) && ts.isIdentifier(obj) && obj.text === 'app') {
          const args = [...n.arguments];
          const prefixe = args[0] && ts.isStringLiteral(args[0]) ? args[0].text : '';
          for (const a of args) {
            if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) {
              routes.push({ methode: methode.toUpperCase(), chemin: normalise(prefixe), fichier: 'server/index.ts', corps: a });
            } else if (ts.isIdentifier(a)) {
              const fCible = fichierDe(index, a.text);
              const trouves = fCible ? enregistrements(fCible, a.text, prefixe) : 0;
              if (trouves === 0) {
                const g = gestionnaireParNom(index, a.text);
                if (g) routes.push({ methode: methode.toUpperCase(), chemin: normalise(prefixe), fichier: g.fichier, corps: g.corps, symbole: a.text });
              }
            }
          }
        }
      }
      ts.forEachChild(n, visite);
    };
    visite(index.sf);
  }

  // ── Graphe d'appel ────────────────────────────────────────────────────────
  const nomsAppeles = (noeud: import('typescript').Node): Set<string> => {
    const out = new Set<string>();
    const visite = (n: import('typescript').Node): void => {
      if (ts.isCallExpression(n)) {
        const e = n.expression;
        if (ts.isIdentifier(e)) out.add(e.text);
        else if (ts.isPropertyAccessExpression(e)) out.add(e.name.text);
      }
      ts.forEachChild(n, visite);
    };
    ts.forEachChild(noeud, visite);
    return out;
  };

  const resout = (nom: string, depuis: string): Symbole | null => {
    const f = fichiers.get(depuis);
    if (!f) return null;
    if (f.fonctions.has(nom)) return { fichier: depuis, fonction: nom };
    const cible = f.imports.get(nom);
    if (cible) {
      for (const candidat of [cible, `${cible}.ts`]) {
        const fc = fichiers.get(candidat);
        if (fc?.fonctions.has(nom)) return { fichier: candidat, fonction: nom };
      }
    }
    return null;
  };

  const appelsDepuis = (fichier: string, noeud: import('typescript').Node): Symbole[] => {
    const out: Symbole[] = [];
    for (const nom of nomsAppeles(noeud)) {
      const s = resout(nom, fichier);
      if (s) out.push(s);
    }
    return out;
  };

  const cle = (s: Symbole) => `${s.fichier}#${s.fonction}`;

  const analyse: Analyse = {
    fichiers,
    routes,
    existe: (s) => Boolean(fichiers.get(s.fichier)?.fonctions.has(s.fonction)),
    cite: (fichier, nom) => Boolean(fichiers.get(fichier)?.identifiants.has(nom)),
    appelle(a, b) {
      const f = fichiers.get(a.fichier);
      const corps = f?.fonctions.get(a.fonction);
      if (!corps) return false;
      return appelsDepuis(a.fichier, corps).some((s) => cle(s) === cle(b));
    },
    appelsDepuis,
    chemin(cible) {
      if (!this.existe(cible)) return null;
      const vus = new Map<string, string[]>();
      const file: { s: Symbole; via: string[] }[] = [];
      // Un intergiciel monté par son nom est lui-même sur le chemin.
      for (const r of routes) {
        if (r.symbole === cible.fonction && r.fichier === cible.fichier) {
          return [`${r.methode} ${r.chemin}`, cle(cible)];
        }
      }
      for (const r of routes) {
        for (const s of appelsDepuis(r.fichier, r.corps)) {
          const depart = [`${r.methode} ${r.chemin}`, cle(s)];
          if (!vus.has(cle(s))) { vus.set(cle(s), depart); file.push({ s, via: depart }); }
        }
      }
      while (file.length) {
        const { s, via } = file.shift()!;
        if (cle(s) === cle(cible)) return via;
        const f = fichiers.get(s.fichier);
        const corps = f?.fonctions.get(s.fonction);
        if (!corps) continue;
        for (const suivant of appelsDepuis(s.fichier, corps)) {
          if (vus.has(cle(suivant))) continue;
          const chemin = [...via, cle(suivant)];
          vus.set(cle(suivant), chemin);
          file.push({ s: suivant, via: chemin });
        }
      }
      return null;
    },
  };

  cacheAnalyse = analyse;
  cacheEmpreinte = empreinte;
  return analyse;
}

/** Le statut d'un avis, tel que le code du dépôt le dit aujourd'hui. */
export type StatutAtteignabilite = 'atteignable' | 'non_atteignable' | 'symbole_absent';

export function statutAvis(symbole: Symbole): { statut: StatutAtteignabilite; chemin: string[] | null } {
  const a = analyseServeur();
  if (!a.existe(symbole)) return { statut: 'symbole_absent', chemin: null };
  const chemin = a.chemin(symbole);
  return chemin ? { statut: 'atteignable', chemin } : { statut: 'non_atteignable', chemin: null };
}

// ════════════════════════════════════════════════════════════════════════════
//  Données de référence
// ════════════════════════════════════════════════════════════════════════════

interface Vuln {
  cve: string; composant: string; version: string; cwe: string; titre: string;
  cvss_base: number; cvss_severite: string; cvss_vecteur: string;
}
interface Kev { cveID: string; dateAdded: string; dueDate: string; knownRansomwareCampaignUse: string }
interface Epss { cve: string; epss: string; percentile: string }

const vulns = (): Vuln[] => fixJson<{ vulnerabilites: Vuln[] }>('m05/sbom-vulns.json').vulnerabilites;
const kev = (): Kev[] => fixJson<{ vulnerabilities: Kev[] }>('m05/kev.json').vulnerabilities;
const epss = (): Epss[] => fixJson<{ data: Epss[] }>('m05/epss.json').data;

const auKev = () => new Set(kev().map((k) => k.cveID));
const epssPar = () => new Map(epss().map((e) => [e.cve, Number(e.epss)]));

/** L'ordre de traitement : exploitation observée, puis probabilité, puis score. */
function ordreTriage(): Vuln[] {
  const k = auKev();
  const p = epssPar();
  return [...vulns()].sort(
    (a, b) =>
      Number(k.has(b.cve)) - Number(k.has(a.cve)) ||
      (p.get(b.cve) ?? 0) - (p.get(a.cve) ?? 0) ||
      b.cvss_base - a.cvss_base ||
      a.cve.localeCompare(b.cve),
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  Dédoublonnage : la règle de référence, que le harnais refait
// ════════════════════════════════════════════════════════════════════════════

interface Brut { outil: string; severite: string; cwe: string; fichier: string; ligne: number; titre: string }
interface Fusionne {
  cle: string; severite: string; cwe: string; fichier: string; ligne: number;
  outils: string[]; titre: string; occurrences: number;
}

const ECHELLE = ['low', 'medium', 'high', 'critical'];
const CORRESPONDANCES: Record<string, Record<string, string>> = {
  semgrep: { INFO: 'low', WARNING: 'medium', ERROR: 'high' },
  njsscan: { INFO: 'low', WARNING: 'medium', ERROR: 'high' },
  snyk: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' },
};

const normaliseChemin = (p: string) => p.replace(/\\/g, '/').replace(/^\.\//, '');
const normaliseCwe = (v: string) => (v.match(/CWE-\d+/) ?? ['CWE-0'])[0];

function litRapports(dir: string): Brut[] {
  const lire = <T>(nom: string): T | null => {
    const f = path.join(dir, nom);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as T) : null;
  };
  const out: Brut[] = [];

  const sg = lire<{ results: { extra: { severity: string; message: string; metadata: { cwe: string[] } }; path: string; start: { line: number } }[] }>('semgrep.json');
  for (const r of sg?.results ?? []) {
    out.push({
      outil: 'semgrep', severite: CORRESPONDANCES.semgrep[r.extra.severity] ?? 'low',
      cwe: normaliseCwe(r.extra.metadata.cwe[0] ?? ''), fichier: normaliseChemin(r.path),
      ligne: r.start.line, titre: r.extra.message,
    });
  }

  const nj = lire<{ nodejs: { severity: string; description: string; cwe: string; files: { file_path: string; match_lines: number[] }[] }[] }>('njsscan.json');
  for (const r of nj?.nodejs ?? []) {
    for (const f of r.files) {
      out.push({
        outil: 'njsscan', severite: CORRESPONDANCES.njsscan[r.severity] ?? 'low',
        cwe: normaliseCwe(r.cwe), fichier: normaliseChemin(f.file_path),
        ligne: f.match_lines[0], titre: r.description,
      });
    }
  }

  const sn = lire<{ runs: { results: { level: string; message: { text: string }; properties: { cwe: string[] }; locations: { physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number } } }[] }[] }[] }>('snyk.json');
  for (const r of sn?.runs?.[0]?.results ?? []) {
    const loc = r.locations[0].physicalLocation;
    out.push({
      outil: 'snyk', severite: CORRESPONDANCES.snyk[r.level] ?? 'low',
      cwe: normaliseCwe(r.properties.cwe[0] ?? ''), fichier: normaliseChemin(loc.artifactLocation.uri),
      ligne: loc.region.startLine, titre: r.message.text,
    });
  }
  return out;
}

function fusionne(dir: string): Fusionne[] {
  const groupes = new Map<string, Brut[]>();
  for (const b of litRapports(dir)) {
    const cle = crypto.createHash('sha256').update(`${b.cwe}|${b.fichier}|${b.ligne}`).digest('hex');
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle)!.push(b);
  }
  const out: Fusionne[] = [];
  for (const [cle, bruts] of groupes) {
    const outils = [...new Set(bruts.map((b) => b.outil))].sort();
    const premier = bruts.filter((b) => b.outil === outils[0])[0];
    const severite = [...bruts].sort((a, b) => ECHELLE.indexOf(b.severite) - ECHELLE.indexOf(a.severite))[0].severite;
    out.push({
      cle, severite, cwe: bruts[0].cwe, fichier: bruts[0].fichier, ligne: bruts[0].ligne,
      outils, titre: premier.titre, occurrences: bruts.length,
    });
  }
  return out.sort((a, b) => a.cle.localeCompare(b.cle));
}

/** Une variante des rapports publiés, fabriquée au moment du contrôle. */
function ecrisVariante(dir: string, decalage: number, prefixe: string, inverse: boolean): void {
  const source = path.join(FIXTURES, 'm05/dedupe');
  const lis = (nom: string) => JSON.parse(fs.readFileSync(path.join(source, nom), 'utf8')) as Record<string, unknown>;

  const sg = lis('semgrep.json') as { results: { path: string; start: { line: number }; end: { line: number } }[] };
  sg.results = sg.results.map((r) => ({ ...r, path: `./${prefixe}${normaliseChemin(r.path)}`, start: { ...r.start, line: r.start.line + decalage }, end: { ...r.end, line: r.end.line + decalage } }));
  if (inverse) sg.results.reverse();

  const nj = lis('njsscan.json') as { nodejs: { files: { file_path: string; match_lines: number[] }[] }[] };
  nj.nodejs = nj.nodejs.map((r) => ({ ...r, files: r.files.map((f) => ({ ...f, file_path: `${prefixe}${f.file_path}`, match_lines: f.match_lines.map((l) => l + decalage) })) }));
  if (inverse) nj.nodejs.reverse();

  const sn = lis('snyk.json') as { runs: { results: { locations: { physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number } } }[] }[] }[] };
  sn.runs[0].results = sn.runs[0].results.map((r) => ({
    ...r,
    locations: r.locations.map((l) => ({
      physicalLocation: {
        artifactLocation: { uri: `${prefixe}${l.physicalLocation.artifactLocation.uri}` },
        region: { ...l.physicalLocation.region, startLine: l.physicalLocation.region.startLine + decalage },
      },
    })),
  }));
  if (inverse) sn.runs[0].results.reverse();

  fs.writeFileSync(path.join(dir, 'semgrep.json'), JSON.stringify(sg, null, 2));
  fs.writeFileSync(path.join(dir, 'njsscan.json'), JSON.stringify(nj, null, 2));
  fs.writeFileSync(path.join(dir, 'snyk.json'), JSON.stringify(sn, null, 2));
}

const CHAMPS_FUSION = ['cle', 'severite', 'cwe', 'fichier', 'ligne', 'outils', 'titre', 'occurrences'] as const;

function compareFusion(rendu: unknown, attendu: Fusionne[], ou: string): string | null {
  const liste = (rendu as { constats?: unknown })?.constats;
  if (!Array.isArray(liste)) return `${ou} : la sortie n’a pas de tableau « constats »`;
  if (liste.length !== attendu.length) {
    return `${ou} : ${liste.length} constats fusionnés au lieu de ${attendu.length}`;
  }
  for (let i = 0; i < attendu.length; i++) {
    const obtenu = liste[i] as Record<string, unknown>;
    if (!obtenu || typeof obtenu !== 'object') return `${ou} : le constat ${i + 1} n’est pas un objet`;
    for (const champ of CHAMPS_FUSION) {
      if (!memeValeur(obtenu[champ], (attendu[i] as unknown as Record<string, unknown>)[champ])) {
        return `${ou} : constat ${i + 1}, champ « ${champ} » — attendu ${JSON.stringify((attendu[i] as unknown as Record<string, unknown>)[champ])}, obtenu ${JSON.stringify(obtenu[champ])}`;
      }
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
//  SSVC
// ════════════════════════════════════════════════════════════════════════════

interface LigneSsvc { exploitation: string; exposure: string; utility: string; human_impact: string; decision: string }
interface CasSsvc { id: string; cve: string; composant: string; exposition_constatee: string; preuve_de_concept_publique: boolean }

const tableSsvc = () =>
  fixJson<{ decision_points: Record<string, string[]>; outcomes: string[]; rows: LigneSsvc[] }>('m05/ssvc-deployer.json');
const casSsvc = () => fixJson<{ cas: CasSsvc[] }>('m05/ssvc-cases.json').cas;

const exploitationDe = (c: CasSsvc) =>
  auKev().has(c.cve) ? 'active' : c.preuve_de_concept_publique ? 'poc' : 'none';

// ════════════════════════════════════════════════════════════════════════════
//  VEX
// ════════════════════════════════════════════════════════════════════════════

interface Avis {
  id: string; composant: string; version: string; cve: string; cwe: string; resume: string;
  symbole: { fichier: string; fonction: string };
}
const avis = () => fixJson<{ avis: Avis[] }>('m05/advisories.json').avis;

/** Les trois avis du document VEX : un atteignable, un mort, un absent. */
const AVIS_VEX = ['NF-ADV-2026-001', 'NF-ADV-2026-004', 'NF-ADV-2026-005'];

const JUSTIFICATION_ATTENDUE: Record<StatutAtteignabilite, string | null> = {
  atteignable: null, // statut « affected », pas de justification
  non_atteignable: 'vulnerable_code_not_in_execute_path',
  symbole_absent: 'vulnerable_code_not_present',
};

// ── Traduction OpenVEX → CycloneDX ──────────────────────────────────────────

const ETATS_CDX: Record<string, string> = {
  not_affected: 'not_affected',
  affected: 'exploitable',
  fixed: 'resolved',
  under_investigation: 'in_triage',
};
const JUSTIFICATIONS_CDX: Record<string, string[]> = {
  component_not_present: ['code_not_present'],
  vulnerable_code_not_present: ['code_not_present'],
  vulnerable_code_not_in_execute_path: ['code_not_reachable'],
  vulnerable_code_cannot_be_controlled_by_adversary: ['requires_configuration', 'protected_at_perimeter'],
  inline_mitigations_already_exist: ['protected_by_mitigating_control'],
};

interface EnonceVex {
  vulnerability: { name: string };
  products: { '@id': string }[];
  status: string;
  justification?: string;
}

/** Une variante du document VEX, fabriquée au moment du contrôle. */
function varianteVex(): { '@context': string; '@id': string; author: string; timestamp: string; version: number; statements: EnonceVex[] } {
  const base = fixJson<{ statements: EnonceVex[] }>('m05/vex-exemple.json');
  const statements = [...base.statements].reverse().map((s, i) => ({
    ...s,
    vulnerability: { name: `CVE-2027-${String(90001 + i)}` },
    products: [{ '@id': `pkg:npm/paquet-variante-${i}@${i + 1}.0.0` }],
  }));
  return {
    '@context': 'https://openvex.dev/ns/v0.2.0',
    '@id': 'https://novafact.example/vex/variante',
    author: 'Harnais du lab',
    timestamp: '2026-09-28T00:00:00.000Z',
    version: 1,
    statements,
  };
}

function verifieTraduction(source: EnonceVex[], rendu: unknown, ou: string): string | null {
  const schema = fixJson<object>('m05/cyclonedx-vex.schema.json');
  const erreurSchema = valideSchema(schema, rendu, `${ou} : le document produit`);
  if (erreurSchema) return erreurSchema;

  const doc = rendu as { vulnerabilities: { id: string; affects: { ref: string }[]; analysis: { state: string; justification?: string } }[] };
  if (doc.vulnerabilities.length !== source.length) {
    return `${ou} : ${doc.vulnerabilities.length} vulnérabilités traduites au lieu de ${source.length}`;
  }
  const parCve = new Map(doc.vulnerabilities.map((v) => [v.id, v]));
  for (const s of source) {
    const v = parCve.get(s.vulnerability.name);
    if (!v) return `${ou} : ${s.vulnerability.name} manque dans le document produit`;
    const etat = ETATS_CDX[s.status];
    if (v.analysis.state !== etat) {
      return `${ou} : ${s.vulnerability.name} — état « ${v.analysis.state} » au lieu de « ${etat} » (OpenVEX « ${s.status} »)`;
    }
    if (s.justification) {
      const permis = JUSTIFICATIONS_CDX[s.justification];
      if (!v.analysis.justification) {
        return `${ou} : ${s.vulnerability.name} — la justification OpenVEX « ${s.justification} » a disparu à la traduction`;
      }
      if (!permis.includes(v.analysis.justification)) {
        return `${ou} : ${s.vulnerability.name} — « ${v.analysis.justification} » ne traduit pas « ${s.justification} » (attendu : ${permis.join(' ou ')})`;
      }
    } else if (v.analysis.justification) {
      return `${ou} : ${s.vulnerability.name} — une justification est ajoutée alors que le statut « ${s.status} » n’en porte pas`;
    }
    const produit = s.products[0]['@id'];
    if (!v.affects.some((a) => a.ref === produit || produit.includes(a.ref) || a.ref.includes(produit))) {
      return `${ou} : ${s.vulnerability.name} — le produit « ${produit} » ne se retrouve pas dans « affects »`;
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
//  SLA
// ════════════════════════════════════════════════════════════════════════════

interface Constat { id: string; cve: string; ssvc: string; kev: boolean; constate_le: string; corrige_le: string | null }
interface Politique { delais: Record<string, number | null>; plafond_kev: number }

const jours = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function horsDelai(constats: Constat[], aujourdhui: string, p: Politique): string[] {
  const out: string[] = [];
  for (const c of constats) {
    let limite = p.delais[c.ssvc] ?? null;
    if (c.kev) limite = limite === null ? p.plafond_kev : Math.min(limite, p.plafond_kev);
    if (limite === null) continue;
    if (jours(c.constate_le, c.corrige_le ?? aujourdhui) > limite) out.push(c.id);
  }
  return out.sort();
}

/** Une variante des constats : mêmes règles, autres dates. */
function varianteSla(source: Constat[], aujourdhui: string): { aujourdhui: string; constats: Constat[] } {
  const neuf = '2026-11-15';
  const constats = source.map((c, i) => {
    const age = jours(c.constate_le, c.corrige_le ?? aujourdhui);
    const decale = (base: string, n: number) => {
      const d = new Date(`${base}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const retard = (i % 3) - 1; // −1, 0, +1 : passe de part et d'autre de la limite
    const nouvelAge = Math.max(0, age + retard);
    const constate = decale(neuf, -nouvelAge - (c.corrige_le ? 5 : 0));
    return {
      ...c,
      id: `V-${String(i + 1).padStart(2, '0')}`,
      constate_le: constate,
      corrige_le: c.corrige_le ? decale(constate, nouvelAge) : null,
    };
  });
  return { aujourdhui: neuf, constats };
}

// ════════════════════════════════════════════════════════════════════════════
//  Les vérifications
// ════════════════════════════════════════════════════════════════════════════

export const m05Checks: Record<string, Check> = {
  // ── Dédoublonnage ─────────────────────────────────────────────────────────

  'finding-dedupe': () => {
    const rel = 'scripts/dedupe.mjs';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;

    const publie = path.join(FIXTURES, 'm05/dedupe');
    const r1 = executeJson(rel, [publie]);
    if (r1.erreur) return r1.erreur;
    const e1 = compareFusion(r1.valeur, fusionne(publie), 'sur le jeu publié');
    if (e1) return e1;

    // Même jeu, entrées dans l'ordre inverse : la sortie doit être identique.
    // Un dédoublonnage qui dépend de l'ordre de lecture n'en est pas un.
    const instable = dansUnDossierTemporaire('dedupe-ordre', (dir) => {
      ecrisVariante(dir, 0, '', true);
      const r = executeJson(rel, [dir]);
      if (r.erreur) return r.erreur;
      return memeValeur(r.valeur, r1.valeur)
        ? null
        : 'relancé sur les mêmes constats dans un autre ordre, le script ne rend pas le même résultat';
    });
    if (instable) return instable;

    // Un jeu que l'apprenant n'a jamais vu : interdit de coder la réponse.
    return dansUnDossierTemporaire('dedupe-variante', (dir) => {
      ecrisVariante(dir, 7, 'packages/api/', false);
      const r = executeJson(rel, [dir]);
      if (r.erreur) return r.erreur;
      return compareFusion(r.valeur, fusionne(dir), 'sur un jeu fabriqué au moment du contrôle');
    });
  },

  // ── Triage ────────────────────────────────────────────────────────────────

  'triage-kev-epss': () => {
    const rel = 'vulns/triage.csv';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;

    const lignes = lisCsv(l.texte);
    const ENTETE = ['rang', 'cve', 'composant', 'cvss_base', 'kev', 'epss', 'justification'];
    const entete = (lignes[0] ?? []).map((c) => c.trim().toLowerCase());
    if (!memeValeur(entete, ENTETE)) {
      return `l’en-tête attendu est « ${ENTETE.join(',')} », trouvé « ${entete.join(',')} »`;
    }
    const corps = lignes.slice(1);
    const attendu = ordreTriage();
    if (corps.length !== attendu.length) {
      return `${corps.length} lignes au lieu de ${attendu.length} : toutes les vulnérabilités du SBOM doivent être ordonnées`;
    }

    const k = auKev();
    const p = epssPar();
    const parCve = new Map(vulns().map((v) => [v.cve, v]));
    const vus = new Set<string>();

    for (let i = 0; i < corps.length; i++) {
      const [rang, cve, composant, base, kevCol, epssCol, justification] = corps[i].map((c) => c.trim());
      const n = i + 1;
      if (Number(rang) !== n) return `ligne ${n} : le rang vaut « ${rang} », attendu ${n} (une ligne par rang, dans l’ordre)`;
      const v = parCve.get(cve);
      if (!v) return `ligne ${n} : « ${cve} » n’est pas une vulnérabilité du SBOM`;
      if (vus.has(cve)) return `ligne ${n} : ${cve} apparaît deux fois`;
      vus.add(cve);
      if (composant !== v.composant) return `ligne ${n} : composant « ${composant} » au lieu de « ${v.composant} »`;
      if (Number(base) !== v.cvss_base) return `ligne ${n} : score de base ${base} au lieu de ${v.cvss_base}`;
      const kevAttendu = k.has(cve) ? 'oui' : 'non';
      if (kevCol.toLowerCase() !== kevAttendu) {
        return `ligne ${n} : ${cve} — colonne kev « ${kevCol} », le catalogue dit « ${kevAttendu} »`;
      }
      const epssAttendu = p.get(cve) ?? 0;
      if (Math.abs(Number(epssCol) - epssAttendu) > 1e-9) {
        return `ligne ${n} : ${cve} — probabilité ${epssCol}, la source dit ${epssAttendu.toFixed(5)}`;
      }
      if (justification.length < 10) return `ligne ${n} : la justification est vide ou trop courte (son contenu n’est pas noté, sa présence l’est)`;
      if (cve !== attendu[i].cve) {
        return `ligne ${n} : ${cve} n’est pas au bon rang — la règle de tri place ${attendu[i].cve} ici`;
      }
    }
    return null;
  },

  // ── SSVC ──────────────────────────────────────────────────────────────────

  'ssvc-decision': () => {
    const rel = 'vulns/ssvc-selections.json';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;
    const doc = wsJson<{ selections: Record<string, string>[] }>(rel);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${rel}\` ${doc ? doc.error : 'est illisible'}`;

    const table = tableSsvc();
    const cas = casSsvc();
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['tree', 'selections'],
      properties: {
        tree: { const: 'Deployer' },
        version: { type: 'string' },
        selections: {
          type: 'array',
          minItems: cas.length,
          maxItems: cas.length,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'exploitation', 'exposure', 'utility', 'human_impact', 'decision'],
            properties: {
              id: { enum: cas.map((c) => c.id) },
              exploitation: { enum: table.decision_points.exploitation },
              exposure: { enum: table.decision_points.exposure },
              utility: { enum: table.decision_points.utility },
              human_impact: { enum: table.decision_points.human_impact },
              decision: { enum: table.outcomes },
              rationale: { type: 'string' },
            },
          },
        },
      },
    };
    const erreur = valideSchema(schema, doc.value, `le livrable \`workspace/${rel}\``);
    if (erreur) return erreur;

    const parId = new Map(doc.value.selections.map((s) => [s.id, s]));
    for (const c of cas) {
      const s = parId.get(c.id);
      if (!s) return `${c.id} n’a pas de sélection`;
      const attenduExploitation = exploitationDe(c);
      if (s.exploitation !== attenduExploitation) {
        return `${c.id} : « exploitation » vaut « ${s.exploitation} » — les données disent « ${attenduExploitation} » (catalogue KEV, puis preuve de concept publique)`;
      }
      if (s.exposure !== c.exposition_constatee) {
        return `${c.id} : « exposure » vaut « ${s.exposure} » — l’exposition constatée en production est « ${c.exposition_constatee} »`;
      }
      const ligne = table.rows.find(
        (r) => r.exploitation === s.exploitation && r.exposure === s.exposure && r.utility === s.utility && r.human_impact === s.human_impact,
      );
      if (!ligne) return `${c.id} : cette combinaison de points n’existe pas dans la table`;
      if (s.decision !== ligne.decision) {
        return `${c.id} : la table rend « ${ligne.decision} » pour ces points, pas « ${s.decision} »`;
      }
    }
    return null;
  },

  // ── VEX ───────────────────────────────────────────────────────────────────

  'vex-not-affected': () => {
    const rel = 'vulns/novafact.openvex.json';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;
    const doc = wsJson<{ statements: { vulnerability: { name: string }; products: { '@id': string }[]; status: string; justification?: string }[] }>(rel);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${rel}\` ${doc ? doc.error : 'est illisible'}`;

    const erreur = valideSchema(fixJson<object>('m05/openvex.schema.json'), doc.value, `le livrable \`workspace/${rel}\``);
    if (erreur) return erreur;

    const tous = avis();
    const concernes = AVIS_VEX.map((id) => tous.find((a) => a.id === id)!).filter(Boolean);
    const enonces = doc.value.statements;
    const attendus = new Set(concernes.map((a) => a.cve));
    for (const e of enonces) {
      if (!attendus.has(e.vulnerability.name)) {
        return `le document porte un énoncé sur ${e.vulnerability.name}, qui n’est pas dans le périmètre des trois avis`;
      }
    }

    for (const a of concernes) {
      const e = enonces.filter((s) => s.vulnerability.name === a.cve);
      if (e.length === 0) return `aucun énoncé pour ${a.cve} (${a.composant})`;
      if (e.length > 1) return `${a.cve} porte ${e.length} énoncés : un seul statut par vulnérabilité et par produit`;
      const s = e[0];

      const nom = a.composant.replace(/^@/, '');
      if (!s.products.some((p) => p['@id'].includes(nom))) {
        return `${a.cve} : aucun produit de l’énoncé ne désigne ${a.composant} (un purl comme « pkg:npm/${a.composant.replace('@', '%40')}@${a.version} »)`;
      }

      const { statut, chemin } = statutAvis(a.symbole);
      const justificationAttendue = JUSTIFICATION_ATTENDUE[statut];

      if (statut === 'atteignable') {
        if (s.status !== 'affected') {
          return `${a.cve} : déclaré « ${s.status} », mais ${a.symbole.fonction}() est bel et bien appelée — ${(chemin ?? []).join(' → ')}`;
        }
        continue;
      }
      if (s.status !== 'not_affected') {
        return `${a.cve} : déclaré « ${s.status} », alors que le code montre que le produit n’est pas affecté`;
      }
      if (s.justification !== justificationAttendue) {
        const pourquoi = statut === 'symbole_absent'
          ? `${a.symbole.fichier} n’existe pas, ou ne définit pas ${a.symbole.fonction}()`
          : `${a.symbole.fonction}() est bien présente mais n’est appelée depuis aucune route montée`;
        return `${a.cve} : justification « ${s.justification ?? '—' } » — ${pourquoi}, donc « ${justificationAttendue} »`;
      }
    }
    return null;
  },

  'vex-to-cyclonedx': () => {
    const rel = 'scripts/vex2cdx.mjs';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;

    const exemple = path.join(FIXTURES, 'm05/vex-exemple.json');
    const source = fixJson<{ statements: EnonceVex[] }>('m05/vex-exemple.json').statements;
    const r1 = executeJson(rel, [exemple]);
    if (r1.erreur) return r1.erreur;
    const e1 = verifieTraduction(source, r1.valeur, 'sur le document publié');
    if (e1) return e1;

    return dansUnDossierTemporaire('vex2cdx', (dir) => {
      const variante = varianteVex();
      const f = path.join(dir, 'variante.openvex.json');
      fs.writeFileSync(f, JSON.stringify(variante, null, 2));
      const r = executeJson(rel, [f]);
      if (r.erreur) return r.erreur;
      return verifieTraduction(variante.statements, r.valeur, 'sur un document fabriqué au moment du contrôle');
    });
  },

  // ── Atteignabilité ────────────────────────────────────────────────────────

  'reachability-ast': () => {
    const rel = 'vulns/reachability.yaml';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;
    const doc = wsYaml<{ avis: Record<string, unknown>[] }>(rel);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${rel}\` ${doc ? doc.error : 'est illisible'}`;

    const tous = avis();
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['avis'],
      properties: {
        avis: {
          type: 'array',
          minItems: tous.length,
          maxItems: tous.length,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'statut'],
            properties: {
              id: { enum: tous.map((a) => a.id) },
              statut: { enum: ['atteignable', 'non_atteignable'] },
              route: { type: 'string' },
              chaine: { type: 'array', items: { type: 'string', pattern: '^[^#]+#[A-Za-z_$][\\w$]*$' } },
              raison: { enum: ['jamais_appelee', 'symbole_absent'] },
              note: { type: 'string' },
            },
          },
        },
      },
    };
    const erreur = valideSchema(schema, doc.value, `le livrable \`workspace/${rel}\``);
    if (erreur) return erreur;

    const analyse = analyseServeur();
    const parId = new Map((doc.value.avis as { id: string }[]).map((a) => [a.id, a as Record<string, unknown>]));

    for (const a of tous) {
      const rendu = parId.get(a.id);
      if (!rendu) return `${a.id} n’a pas de verdict`;
      const { statut, chemin } = statutAvis(a.symbole);

      if (rendu.statut === 'non_atteignable') {
        if (statut === 'atteignable') {
          return `${a.id} : déclaré non atteignable, mais le code donne le chemin ${(chemin ?? []).join(' → ')}`;
        }
        const raisonAttendue = statut === 'symbole_absent' ? 'symbole_absent' : 'jamais_appelee';
        if (rendu.raison !== raisonAttendue) {
          return `${a.id} : la raison attendue est « ${raisonAttendue} » — ${statut === 'symbole_absent' ? `${a.symbole.fichier} ne définit pas ${a.symbole.fonction}()` : `${a.symbole.fonction}() existe, mais aucune route montée n’y mène`}`;
        }
        continue;
      }

      // Statut « atteignable » : la chaîne déclarée est rejouée maillon par maillon.
      if (statut !== 'atteignable') {
        const pourquoi = statut === 'symbole_absent'
          ? `${a.symbole.fichier} ne définit pas ${a.symbole.fonction}()`
          : `${a.symbole.fonction}() n’est appelée depuis aucune route montée`;
        return `${a.id} : déclaré atteignable, mais ${pourquoi}`;
      }
      const route = String(rendu.route ?? '');
      const chaine = (rendu.chaine as string[] | undefined) ?? [];
      if (!route) return `${a.id} : le point d’entrée manque (champ « route », par exemple « POST /api/invoices »)`;
      if (!chaine.length) return `${a.id} : la chaîne d’appel manque (champ « chaine »)`;

      const [methode, ...reste] = route.trim().split(/\s+/);
      const cheminHttp = reste.join(' ');
      const routes = analyse.routes.filter((r) => r.methode === methode.toUpperCase() && r.chemin === cheminHttp);
      if (!routes.length) {
        return `${a.id} : « ${route} » n’est pas une route montée par server/index.ts`;
      }

      const maillons = chaine.map((s) => {
        const [fichier, fonction] = s.split('#');
        return { fichier: fichier.trim(), fonction: fonction.trim() };
      });
      const dernier = maillons[maillons.length - 1];
      if (dernier.fichier !== a.symbole.fichier || dernier.fonction !== a.symbole.fonction) {
        return `${a.id} : la chaîne doit se terminer sur ${a.symbole.fichier}#${a.symbole.fonction}, pas sur ${dernier.fichier}#${dernier.fonction}`;
      }
      for (const m of maillons) {
        if (!analyse.existe(m)) return `${a.id} : ${m.fichier} ne définit aucune fonction « ${m.fonction} »`;
      }
      const depuisLaRoute = routes.some(
        (r) =>
          // Le gestionnaire monté par son nom EST le premier maillon.
          (r.symbole === maillons[0].fonction && r.fichier === maillons[0].fichier) ||
          analyse.appelsDepuis(r.fichier, r.corps).some((s) => s.fichier === maillons[0].fichier && s.fonction === maillons[0].fonction),
      );
      if (!depuisLaRoute) {
        return `${a.id} : le gestionnaire de « ${route} » n’appelle pas ${maillons[0].fichier}#${maillons[0].fonction}`;
      }
      for (let i = 0; i < maillons.length - 1; i++) {
        if (!analyse.appelle(maillons[i], maillons[i + 1])) {
          return `${a.id} : ${maillons[i].fichier}#${maillons[i].fonction} n’appelle pas ${maillons[i + 1].fichier}#${maillons[i + 1].fonction}`;
        }
      }
    }
    return null;
  },

  // ── SLA ───────────────────────────────────────────────────────────────────

  'sla-policy': () => {
    const relPolitique = 'vulns/sla-policy.yaml';
    const relScript = 'scripts/sla-report.mjs';
    const lp = livrable(relPolitique);
    if ('raison' in lp) return lp.raison;
    const ls = livrable(relScript);
    if ('raison' in ls) return ls.raison;

    const doc = wsYaml<{ delais: Record<string, number | null>; plafond_kev: number }>(relPolitique);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${relPolitique}\` ${doc ? doc.error : 'est illisible'}`;

    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'unite', 'delais', 'plafond_kev'],
      properties: {
        version: { type: 'integer', minimum: 1 },
        unite: { const: 'jours' },
        delais: {
          type: 'object',
          additionalProperties: false,
          required: ['immediate', 'out-of-cycle', 'scheduled', 'defer'],
          properties: {
            immediate: { type: 'integer', minimum: 0 },
            'out-of-cycle': { type: 'integer', minimum: 0 },
            scheduled: { type: 'integer', minimum: 0 },
            defer: { type: 'null' },
          },
        },
        plafond_kev: { type: 'integer', minimum: 0 },
        note: { type: 'string' },
      },
    };
    const erreur = valideSchema(schema, doc.value, `le livrable \`workspace/${relPolitique}\``);
    if (erreur) return erreur;

    const p: Politique = { delais: doc.value.delais, plafond_kev: doc.value.plafond_kev };

    // Les deux contraintes que la directive de référence impose.
    if (!(p.plafond_kev < (p.delais.scheduled ?? Infinity))) {
      return `le délai d’une vulnérabilité activement exploitée (${p.plafond_kev} j) doit être strictement plus court que celui d’une critique ordinaire (${p.delais.scheduled} j)`;
    }
    const echeanceOfficielle = (() => {
      const k = kev()[0];
      return jours(k.dateAdded, k.dueDate);
    })();
    if (p.plafond_kev > echeanceOfficielle) {
      return `le plafond pour le catalogue KEV (${p.plafond_kev} j) dépasse l’échéance officielle du catalogue (${echeanceOfficielle} j)`;
    }

    // La politique appliquée aux constats au verdict connu.
    const source = fixJson<{ aujourdhui: string; constats: Constat[] }>('m05/sla-findings.json');
    const attendu = ['F-02', 'F-04', 'F-06', 'F-10', 'F-12', 'F-14', 'F-16', 'F-18', 'F-19'];
    const obtenu = horsDelai(source.constats, source.aujourdhui, p);
    if (!memeValeur(obtenu, attendu)) {
      const manquants = attendu.filter((id) => !obtenu.includes(id));
      const enTrop = obtenu.filter((id) => !attendu.includes(id));
      return [
        'appliquée aux constats de référence, la politique ne rend pas le verdict connu',
        manquants.length ? `elle laisse passer ${manquants.join(', ')}` : '',
        enTrop.length ? `elle déclare hors délai ${enTrop.join(', ')}` : '',
      ].filter(Boolean).join(' — ');
    }

    // Le script, confronté à des constats qu'il n'a jamais vus.
    return dansUnDossierTemporaire('sla', (dir) => {
      const variante = varianteSla(source.constats, source.aujourdhui);
      const f = path.join(dir, 'constats.json');
      fs.writeFileSync(f, JSON.stringify(variante, null, 2));
      const r = executeJson(relScript, [f, wsPath(relPolitique)!]);
      if (r.erreur) return r.erreur;
      const liste = (r.valeur as { hors_delai?: unknown })?.hors_delai;
      if (!Array.isArray(liste)) return `la sortie de \`workspace/${relScript}\` n’a pas de tableau « hors_delai »`;
      const attenduVariante = horsDelai(variante.constats, variante.aujourdhui, p);
      if (!memeValeur([...liste].sort(), attenduVariante)) {
        return `sur des constats fabriqués au moment du contrôle, le script rend ${JSON.stringify([...liste].sort())} là où ta propre politique donne ${JSON.stringify(attenduVariante)}`;
      }
      return null;
    });
  },

  // ── Agrégation ────────────────────────────────────────────────────────────

  'findings-aggregate': () => {
    const rel = 'vulns/findings.json';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;
    const doc = wsJson<{ constats: Record<string, unknown>[] }>(rel);
    if (doc === null || 'error' in doc) return `le livrable \`workspace/${rel}\` ${doc ? doc.error : 'est illisible'}`;

    const liste = vulns();
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['constats'],
      properties: {
        genere_le: { type: 'string', format: 'date-time' },
        source: { type: 'string' },
        constats: {
          type: 'array',
          minItems: liste.length,
          maxItems: liste.length,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['cve', 'kev', 'epss'],
            properties: {
              cve: { type: 'string', pattern: '^CVE-\\d{4}-\\d{4,}$' },
              composant: { type: 'string' },
              version: { type: 'string' },
              cwe: { type: 'string', pattern: '^CWE-\\d+$' },
              cvss_base: { type: 'number', minimum: 0, maximum: 10 },
              cvss_severite: { enum: ['none', 'low', 'medium', 'high', 'critical'] },
              cvss_vecteur: { type: 'string' },
              kev: { type: 'boolean' },
              epss: { type: 'number', minimum: 0, maximum: 1 },
              epss_percentile: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
    };
    const erreur = valideSchema(schema, doc.value, `le livrable \`workspace/${rel}\``);
    if (erreur) return erreur;

    const k = auKev();
    const p = epssPar();
    const parCve = new Map(liste.map((v) => [v.cve, v]));
    const vus = new Set<string>();
    for (const c of doc.value.constats) {
      const cve = String(c.cve);
      const v = parCve.get(cve);
      if (!v) return `${cve} n’est pas une vulnérabilité du SBOM`;
      if (vus.has(cve)) return `${cve} apparaît deux fois`;
      vus.add(cve);
      if (c.kev !== k.has(cve)) return `${cve} : « kev » vaut ${c.kev}, le catalogue dit ${k.has(cve)}`;
      if (Math.abs(Number(c.epss) - (p.get(cve) ?? -1)) > 1e-9) {
        return `${cve} : « epss » vaut ${c.epss}, la source dit ${(p.get(cve) ?? 0).toFixed(5)}`;
      }
      if (c.composant !== undefined && c.composant !== v.composant) return `${cve} : composant « ${c.composant} » au lieu de « ${v.composant} »`;
      if (c.cvss_base !== undefined && Number(c.cvss_base) !== v.cvss_base) return `${cve} : score de base ${c.cvss_base} au lieu de ${v.cvss_base}`;
      if (c.cwe !== undefined && c.cwe !== v.cwe) return `${cve} : CWE « ${c.cwe} » au lieu de « ${v.cwe} »`;
    }
    return null;
  },

  // ── Divulgation ───────────────────────────────────────────────────────────

  'disclosure-policy': () => {
    const rel = 'public/.well-known/security.txt';
    const l = livrable(rel);
    if ('raison' in l) return l.raison;

    const champs: { nom: string; valeur: string }[] = [];
    for (const brute of l.texte.split('\n')) {
      const ligne = brute.trim();
      if (ligne === '' || ligne.startsWith('#')) continue;
      if (ligne.startsWith('-----BEGIN') || ligne.startsWith('-----END')) break; // signature détachée
      const m = ligne.match(/^([A-Za-z-]+):\s*(.+)$/);
      if (!m) return `la ligne « ${ligne.slice(0, 60)} » n’a pas la forme « Champ: valeur » exigée par la RFC 9116`;
      champs.push({ nom: m[1].toLowerCase(), valeur: m[2].trim() });
    }

    const valeurs = (nom: string) => champs.filter((c) => c.nom === nom).map((c) => c.valeur);

    const contacts = valeurs('contact');
    if (!contacts.length) return 'le champ obligatoire « Contact » manque';
    for (const c of contacts) {
      if (!/^(mailto:[^@\s]+@[^\s]+|https:\/\/\S+|tel:\+?[\d\s.-]+)$/.test(c)) {
        return `« Contact: ${c} » n’est pas une URI : la RFC 9116 attend « mailto: », « https:// » ou « tel: »`;
      }
    }

    const expires = valeurs('expires');
    if (expires.length === 0) return 'le champ obligatoire « Expires » manque — sans lui, personne ne sait si le fichier est encore tenu';
    if (expires.length > 1) return `« Expires » apparaît ${expires.length} fois : la RFC 9116 n’en autorise qu’un`;
    const quand = Date.parse(expires[0]);
    if (Number.isNaN(quand)) return `« Expires: ${expires[0]} » n’est pas un horodatage ISO 8601`;
    const maintenant = Date.now();
    if (quand <= maintenant) return `le fichier est expiré depuis le ${new Date(quand).toISOString().slice(0, 10)} : un security.txt expiré dit que personne ne s’en occupe`;
    if (quand - maintenant > 366 * 86_400_000) {
      return `« Expires » est à plus d’un an (${new Date(quand).toISOString().slice(0, 10)}) : la RFC 9116 demande une échéance courte, pour forcer la relecture`;
    }

    for (const nom of ['policy', 'canonical', 'acknowledgments', 'encryption', 'hiring', 'csaf']) {
      for (const v of valeurs(nom)) {
        if (!/^https:\/\/\S+$/.test(v)) return `« ${nom} » doit porter une URI https, pas « ${v} »`;
      }
    }
    if (valeurs('preferred-languages').length > 1) return '« Preferred-Languages » ne peut apparaître qu’une fois';
    if (!valeurs('policy').length) return 'le champ « Policy » manque : le chercheur doit pouvoir lire les règles avant de tester';
    return null;
  },
};
