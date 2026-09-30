// Vérifications des challenges M1 · Programme AppSec & DevSecOps.
//
// Premier module de type « artifact » du lab : l'apprenant ne corrige pas un
// fichier livré, il en PRODUIT un dans `workspace/`, et c'est ce fichier qui est
// jugé. Les données de départ — rapport de pentest, modèle de maturité, scan de
// dépendances, catalogue d'exploitation connue — sont embarquées dans
// `fixtures/m01/`.
//
// Quatre motifs de correction, par ordre de solidité, et aucun autre :
//
//   · **confrontation au code** — une preuve citée doit exister, une classe de
//     bug doit correspondre au CWE du registre, un test cité doit se trouver
//     dans le dépôt. Un livrable qui invente un chemin est rejeté.
//
//   · **recalcul** — le score d'une évaluation est refait à partir des seules
//     réponses, l'écart d'une comparaison est recalculé à partir des seules
//     observations. Rien de tout cela ne se code en dur : le résultat dépend de
//     ce que l'apprenant a répondu.
//
//   · **différentiel** — la porte de CI et le déclencheur de signalement sont
//     exécutés contre des jeux que le harnais fabrique à la volée, moitié à
//     bloquer, moitié à laisser passer. Trop large, ils échouent sur les
//     seconds ; trop étroits, sur les premiers. Un nom de fichier ne dit rien,
//     il est tiré au hasard.
//
//   · **double critère** — partout où le raccourci paresseux existe, il faut le
//     refuser explicitement : une porte qui bloque toujours n'est pas une
//     porte, une attestation dont tout est « non applicable » n'atteste rien.
//
// Ce qui n'est PAS jugé, et que les énoncés disent : la sincérité d'une
// auto-évaluation, la pertinence métier d'une feuille de route, la qualité
// rédactionnelle d'un motif. Ce sont des jugements d'expert — précisément ce
// qu'on voudrait évaluer, et précisément ce qu'aucun harnais ne sait faire.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { exerciseById } from '../../shared/exercises.ts';
import { LAB_ROOT, missing, run, wsText, wsYaml, type RunResult } from './workspace.ts';

export type Check = () => string | null;

// ── Outils partagés par m01, m06 et m07 ─────────────────────────────────────
//
// Ils vivent ici plutôt que dans un module à part : les trois modules
// « artifact » ont été écrits ensemble, et un quatrième fichier dans
// server/audit/ pour quarante lignes d'aide se paierait à chaque relecture.

export const FIXTURES = path.join(LAB_ROOT, 'fixtures');

/** Un fichier des données embarquées. Son absence est un bug du lab, pas de l'apprenant. */
export function fixtureText(rel: string): string {
  const full = path.join(FIXTURES, rel);
  if (!fs.existsSync(full)) throw new Error(`données embarquées manquantes : fixtures/${rel}`);
  return fs.readFileSync(full, 'utf8');
}

export const fixtureJson = <T>(rel: string): T => JSON.parse(fixtureText(rel)) as T;
export const fixtureYaml = <T>(rel: string): T => loadYaml(fixtureText(rel)) as T;

/** Résout un chemin cité par l'apprenant dans l'arbre du lab, sans en sortir. */
export function labResolve(rel: string): string | null {
  if (typeof rel !== 'string' || rel.trim() === '') return null;
  const clean = rel.trim().replace(/^\.\//, '');
  if (path.isAbsolute(clean)) return null;
  const full = path.resolve(LAB_ROOT, clean);
  return full.startsWith(LAB_ROOT + path.sep) ? full : null;
}

/** Vrai si le chemin cité existe réellement (fichier ou dossier). */
export function labExists(rel: string): boolean {
  const full = labResolve(rel);
  return full !== null && fs.existsSync(full);
}

/** Le contenu d'un fichier de l'arbre du lab, ou null. */
export function labText(rel: string): string | null {
  const full = labResolve(rel);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return fs.readFileSync(full, 'utf8');
}

/** Le code sans ses commentaires — un commentaire ne vaut pas un contrôle. */
export const stripComments = (code: string): string =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/^\s*#(?![!\[]).*$/gm, ' ');

export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
export const asText = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
export const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

export const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];
/** Les raisons, mises bout à bout. On en montre quelques-unes, pas quarante. */
export const joined = (bad: string[], max = 6): string | null =>
  bad.length === 0
    ? null
    : bad.slice(0, max).join(' · ') + (bad.length > max ? ` · … et ${bad.length - max} autre(s)` : '');

/** Le livrable YAML, ou la raison pour laquelle on ne peut rien en dire. */
export function needYaml<T = unknown>(rel: string): { value: T } | { error: string } {
  const raw = wsYaml<T>(rel);
  if (raw === null) return { error: missing(rel) };
  if ('error' in raw) return { error: `le livrable \`workspace/${rel}\` ${raw.error}` };
  if (raw.value === null || typeof raw.value !== 'object') {
    return { error: `le livrable \`workspace/${rel}\` est vide ou ne contient pas de structure` };
  }
  return raw;
}

/** Le livrable texte, non vide. */
export function needText(rel: string): { value: string } | { error: string } {
  const raw = wsText(rel);
  if (raw === null) return { error: missing(rel) };
  if (raw.trim() === '') return { error: `le livrable \`workspace/${rel}\` est vide` };
  return { value: raw };
}

/**
 * Un CSV simple : séparateur déduit de l'en-tête (« ; » ou « , »), guillemets
 * doubles échappés par doublement. Les lignes vides et les lignes de
 * commentaire (« # ») sont ignorées.
 */
export function parseCsv(raw: string): { header: string[]; rows: Record<string, string>[] } {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.trimStart().startsWith('#'));
  if (lines.length === 0) return { header: [], rows: [] };
  const sep = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';

  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
        else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === sep) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  };

  const header = split(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])) as Record<string, string>;
  });
  return { header, rows };
}

/** Un répertoire temporaire propre à une vérification, effacé ensuite. */
export function withTempDir<T>(prefix: string, fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Le dernier objet JSON écrit par un harnais sur sa sortie standard. */
export function lastJson<T>(out: string): T | null {
  const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].startsWith('{')) continue;
    try { return JSON.parse(lines[i]) as T; } catch { /* ligne suivante */ }
  }
  return null;
}

// ── Données embarquées du module ────────────────────────────────────────────

interface Constat { id: string; titre: string; severite: string; endpoint: string }
interface RapportPentest { rapport: string; constats: Constat[] }

interface Equipe { handle: string; nom: string }
interface Organisation { equipes: Equipe[]; securite: string }

export const organisation = (): Organisation => fixtureYaml<Organisation>('m01/organisation.yaml');
export const equipeHandles = (): Set<string> => new Set(organisation().equipes.map((e) => e.handle));

/**
 * La classe de bugs à laquelle appartient chaque constat du rapport.
 *
 * C'est la seule réponse que le harnais détient : le rapport, lui, ne nomme ni
 * CWE ni classe. Regrouper treize constats en neuf classes est tout le travail
 * de l'exercice — et ce regroupement-là n'est pas une affaire d'opinion, il se
 * lit dans le code.
 */
const CLASSE_DU_CONSTAT: Record<string, string> = {
  'PT-01': 'nosql-auth',
  'PT-02': 'jwt-decode',
  'PT-03': 'bola-invoice',
  'PT-04': 'mass-assignment',
  'PT-05': 'path-traversal',
  'PT-06': 'ssrf-imds',
  'PT-07': 'dom-xss',
  'PT-08': 'no-rate-limit',
  'PT-09': 'bola-invoice',
  'PT-10': 'money-float',
  'PT-11': 'nosql-auth',
  'PT-12': 'dom-xss',
  'PT-13': 'mass-assignment',
};

const RANG_SEVERITE: Record<string, number> = { critique: 3, elevee: 2, moyenne: 1, faible: 0 };

// ── Modèle de maturité ──────────────────────────────────────────────────────

interface ActiviteSamm { id: string; niveau: number; nom: string }
interface FluxSamm { id: string; nom: string; activites: ActiviteSamm[] }
interface PratiqueSamm { id: string; nom: string; flux: FluxSamm[] }
interface FonctionSamm { id: string; nom: string; pratiques: PratiqueSamm[] }

export const VALEUR_REPONSE: Record<string, number> = { non: 0, partiel: 0.5, oui: 1 };
const SEUIL_ROADMAP = 1.5;

const modeleSamm = (): FonctionSamm[] =>
  fixtureYaml<{ fonctions: FonctionSamm[] }>('m01/samm-model.yaml').fonctions;

const tousLesFlux = (): { fonction: string; pratique: string; flux: FluxSamm }[] =>
  modeleSamm().flatMap((f) =>
    f.pratiques.flatMap((p) => p.flux.map((flux) => ({ fonction: f.id, pratique: p.id, flux }))),
  );

const arrondi = (n: number): number => Math.round(n * 100) / 100;
const proche = (a: number, b: number): boolean => Math.abs(a - b) < 0.005;

/** L'évaluation relue et recalculée, ou la raison pour laquelle elle ne l'est pas. */
interface EvaluationSamm {
  reponses: Map<string, Record<string, number>>; // flux → activité → valeur
  scoresFlux: Map<string, number>;
  scoresPratique: Map<string, number>;
  scoresFonction: Map<string, number>;
  global: number;
}

function relireEvaluation(): { evaluation: EvaluationSamm } | { error: string } {
  const doc = needYaml<{ evaluation?: unknown }>('program/samm-assessment.yaml');
  if ('error' in doc) return doc;

  const entrees = asArray(asRecord(doc.value).evaluation);
  if (entrees.length === 0) return { error: 'l’évaluation ne contient aucune entrée sous la clé `evaluation`' };

  const flux = tousLesFlux();
  const attendus = new Map(flux.map((f) => [f.flux.id, f]));
  const reponses = new Map<string, Record<string, number>>();
  const bad: string[] = [];

  for (const brut of entrees) {
    const e = asRecord(brut);
    const id = asText(e.flux);
    const ref = attendus.get(id);
    if (!ref) { bad.push(`le flux « ${id || '(sans nom)'} » n’existe pas dans le modèle`); continue; }
    if (reponses.has(id)) { bad.push(`le flux ${id} est évalué deux fois`); continue; }

    const rep = asRecord(e.reponses);
    const valeurs: Record<string, number> = {};
    for (const act of ref.flux.activites) {
      const v = asText(rep[act.id]);
      if (v === '') { bad.push(`${id} : l’activité ${act.id} n’a pas de réponse`); continue; }
      if (!(v in VALEUR_REPONSE)) {
        bad.push(`${id} : « ${v} » n’est pas une réponse admise pour ${act.id} (non · partiel · oui)`);
        continue;
      }
      valeurs[act.id] = VALEUR_REPONSE[v];
    }
    const inconnues = Object.keys(rep).filter((k) => !ref.flux.activites.some((a) => a.id === k));
    if (inconnues.length) bad.push(`${id} : ${inconnues.join(', ')} n’appartient pas à ce flux`);
    if (Object.keys(valeurs).length === ref.flux.activites.length) reponses.set(id, valeurs);
  }

  const manquants = flux.filter((f) => !reponses.has(f.flux.id)).map((f) => f.flux.id);
  if (manquants.length) bad.push(`aucune réponse pour ${manquants.slice(0, 5).join(', ')}${manquants.length > 5 ? ` (+${manquants.length - 5})` : ''}`);
  if (bad.length) return { error: joined(bad)! };

  // Monotonie : un niveau ne peut pas être mieux tenu que celui d'en dessous.
  for (const f of flux) {
    const v = reponses.get(f.flux.id)!;
    const suite = f.flux.activites.slice().sort((a, b) => a.niveau - b.niveau).map((a) => v[a.id]);
    for (let i = 1; i < suite.length; i += 1) {
      if (suite[i] > suite[i - 1]) {
        bad.push(`${f.flux.id} : le niveau ${i + 1} est déclaré mieux tenu que le niveau ${i} — une maturité ne se saute pas`);
      }
    }
  }
  if (bad.length) return { error: joined(bad)! };

  const scoresFlux = new Map(
    flux.map((f) => [f.flux.id, arrondi(Object.values(reponses.get(f.flux.id)!).reduce((s, x) => s + x, 0))]),
  );
  const scoresPratique = new Map<string, number>();
  const scoresFonction = new Map<string, number>();
  for (const fonction of modeleSamm()) {
    for (const pratique of fonction.pratiques) {
      const moyenne = pratique.flux.reduce((s, fl) => s + scoresFlux.get(fl.id)!, 0) / pratique.flux.length;
      scoresPratique.set(pratique.id, arrondi(moyenne));
    }
    const moyenne = fonction.pratiques.reduce((s, p) => s + scoresPratique.get(p.id)!, 0) / fonction.pratiques.length;
    scoresFonction.set(fonction.id, arrondi(moyenne));
  }
  const global = arrondi(
    [...scoresFonction.values()].reduce((s, x) => s + x, 0) / scoresFonction.size,
  );

  return { evaluation: { reponses, scoresFlux, scoresPratique, scoresFonction, global } };
}

/** Le niveau réellement atteint par un flux : le plus haut palier entièrement tenu. */
function niveauAtteint(valeurs: Record<string, number>, activites: ActiviteSamm[]): number {
  const suite = activites.slice().sort((a, b) => a.niveau - b.niveau);
  let atteint = 0;
  for (const act of suite) {
    if (valeurs[act.id] === 1) atteint = act.niveau;
    else break;
  }
  return atteint;
}

// ── Catalogue d'exploitation connue et analyse de composition ───────────────

interface EntreeKev { cveID: string; product: string }
interface VulnScan { id: string; severity: string; fixed: string | null }
interface PaquetScan { package: { name: string; version: string }; vulnerabilities: VulnScan[] }

export const catalogueKev = (): Set<string> =>
  new Set(fixtureJson<{ vulnerabilities: EntreeKev[] }>('m01/kev.json').vulnerabilities.map((v) => v.cveID));

const paquetsScannes = (): PaquetScan[] =>
  fixtureJson<{ results: { packages: PaquetScan[] }[] }>('m01/osv-scan.json').results.flatMap((r) => r.packages);

// ── TOML, sous-ensemble suffisant pour osv-scanner.toml ─────────────────────
//
// Une dépendance de plus pour lire quinze lignes de configuration ne se
// justifie pas. Ce qui suit couvre exactement ce que le format d'exclusion
// d'osv-scanner utilise : des tableaux de tables, des chaînes, des dates.

export function parseToml(raw: string): Record<string, Record<string, string>[]> {
  const out: Record<string, Record<string, string>[]> = {};
  let table: Record<string, string> | null = null;

  const lignes = raw.split(/\r?\n/);
  for (let i = 0; i < lignes.length; i += 1) {
    let ligne = lignes[i];
    // Un « # » hors chaîne ouvre un commentaire.
    let horsChaine = true;
    for (let c = 0; c < ligne.length; c += 1) {
      if (ligne[c] === '"' || ligne[c] === "'") horsChaine = !horsChaine;
      else if (ligne[c] === '#' && horsChaine) { ligne = ligne.slice(0, c); break; }
    }
    ligne = ligne.trim();
    if (ligne === '') continue;

    const tableau = ligne.match(/^\[\[\s*([A-Za-z0-9_.-]+)\s*\]\]$/);
    if (tableau) {
      table = {};
      (out[tableau[1]] ??= []).push(table);
      continue;
    }
    if (/^\[[^[]/.test(ligne)) { table = null; continue; }

    const paire = ligne.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*)$/);
    if (!paire || table === null) continue;
    const [, cle, brut] = paire;

    if (brut.startsWith('"""')) {
      // Chaîne multi-ligne : on recolle jusqu'au délimiteur fermant.
      let valeur = brut.slice(3);
      while (!valeur.includes('"""') && i + 1 < lignes.length) {
        i += 1;
        valeur += `\n${lignes[i]}`;
      }
      table[cle] = valeur.slice(0, valeur.indexOf('"""') === -1 ? undefined : valeur.indexOf('"""')).trim();
      continue;
    }
    const chaine = brut.match(/^"((?:\\.|[^"])*)"|^'([^']*)'/);
    table[cle] = chaine ? (chaine[1] ?? chaine[2]).replace(/\\"/g, '"') : brut.trim();
  }
  return out;
}

// ── Fabrique de jeux d'essai pour les exécutables produits ──────────────────

const alea = (n: number) => Math.floor(Math.random() * n);
const choix = <T>(xs: T[]): T => xs[alea(xs.length)];

interface CasPorte { fichier: string; bloquant: boolean }

/**
 * Des rapports d'analyse tirés au hasard, moitié bloquants, moitié non.
 *
 * Les noms de fichiers sont aléatoires : une porte qui reconnaîtrait les deux
 * rapports de référence par leur nom n'a rien implémenté.
 */
function fabriquerRapports(dir: string): CasPorte[] {
  const paquets = ['minimist-ng', 'pdf-render', 'xlsx-lite', 'tar-stream-legacy', 'node-ical', 'graphql-depth', 'color-name-map'];
  const cas: CasPorte[] = [];

  for (let i = 0; i < 12; i += 1) {
    // Un cas sur deux est construit pour bloquer, l'autre pour passer.
    const doitBloquer = i % 2 === 0;
    const vulns: { nom: string; v: VulnScan }[] = [];
    const nbBruit = alea(3);
    for (let j = 0; j < nbBruit; j += 1) {
      // Du bruit qui ne doit JAMAIS bloquer : sévérité basse, ou pas de correctif.
      vulns.push({
        nom: choix(paquets),
        v: doitBloquer || alea(2) === 0
          ? { id: `CVE-2026-${1000 + alea(9000)}`, severity: choix(['LOW', 'MEDIUM']), fixed: `1.${alea(9)}.0` }
          : { id: `CVE-2026-${1000 + alea(9000)}`, severity: choix(['HIGH', 'CRITICAL']), fixed: null },
      });
    }
    if (doitBloquer) {
      vulns.push({
        nom: choix(paquets),
        v: { id: `CVE-2026-${1000 + alea(9000)}`, severity: choix(['HIGH', 'CRITICAL']), fixed: `2.${alea(9)}.1` },
      });
    }

    const rapport = {
      date: '2026-09-22',
      results: [{
        source: { path: 'package-lock.json', type: 'lockfile' },
        packages: vulns.map(({ nom, v }) => ({
          package: { name: nom, version: `1.${alea(9)}.${alea(9)}`, ecosystem: 'npm' },
          vulnerabilities: [v],
        })),
      }],
    };
    const fichier = path.join(dir, `${Math.random().toString(36).slice(2, 10)}.json`);
    fs.writeFileSync(fichier, JSON.stringify(rapport, null, 2));
    cas.push({ fichier, bloquant: doitBloquer });
  }
  return cas;
}

interface CasCra { sbom: string; kev: string; date: string; attendu: { notification: boolean; obligations: unknown[] } }

const DUREE_ALERTE_H = 24;
const DUREE_NOTIFICATION_H = 72;

function echeances(date: string): { alerte: string; notification: string } {
  const t = new Date(date).getTime();
  return {
    alerte: new Date(t + DUREE_ALERTE_H * 3600_000).toISOString(),
    notification: new Date(t + DUREE_NOTIFICATION_H * 3600_000).toISOString(),
  };
}

/** Le calcul de référence : c'est lui que le script de l'apprenant doit retrouver. */
function decisionCra(sbom: Record<string, unknown>, kev: Set<string>, date: string) {
  const composants = asArray(sbom.components).map(asRecord);
  const parRef = new Map(composants.map((c) => [asText(c.purl), c]));
  const obligations = asArray(sbom.vulnerabilities)
    .map(asRecord)
    .filter((v) => kev.has(asText(v.id)))
    .flatMap((v) =>
      asArray(v.affects).map(asRecord).map((a) => {
        const composant = parRef.get(asText(a.ref));
        const { alerte, notification } = echeances(date);
        return {
          composant: asText(composant?.name),
          version: asText(composant?.version),
          vulnerabilite: asText(v.id),
          alerteAvant: alerte,
          notificationAvant: notification,
        };
      }),
    )
    .sort((a, b) => a.vulnerabilite.localeCompare(b.vulnerabilite));
  return { notification: obligations.length > 0, obligations };
}

function fabriquerCasCra(dir: string): CasCra[] {
  const pool = ['express', 'xlsx-lite', 'pdf-render', 'jsonwebtoken-compat', 'node-ical', 'img-resize-native', 'graphql-depth'];
  const cas: CasCra[] = [];

  // Les trois SBOM d'essai nommés par l'énoncé, avec le catalogue embarqué.
  const kevFixe = path.join(FIXTURES, 'm01/kev.json');
  const kevSet = catalogueKev();
  for (const nom of ['sbom-kev.json', 'sbom-hors-kev.json', 'sbom-multiple.json']) {
    const chemin = path.join(FIXTURES, 'm01/cra', nom);
    const date = '2026-09-22T09:00:00.000Z';
    cas.push({
      sbom: chemin,
      kev: kevFixe,
      date,
      attendu: decisionCra(fixtureJson<Record<string, unknown>>(`m01/cra/${nom}`), kevSet, date),
    });
  }

  // Puis des cas tirés au hasard, catalogue compris : rien ne se code en dur.
  for (let i = 0; i < 8; i += 1) {
    const composants = uniq(Array.from({ length: 2 + alea(4) }, () => choix(pool))).map((nom) => ({
      name: nom,
      version: `${alea(5)}.${alea(20)}.${alea(9)}`,
      purl: `pkg:npm/${nom}@${alea(5)}.${alea(20)}.${alea(9)}`,
    }));
    const vulns = composants
      .filter(() => alea(2) === 0)
      .map((c) => ({ id: `CVE-2026-${1000 + alea(9000)}`, affects: [{ ref: c.purl }] }));
    const exploitees = vulns.filter(() => alea(2) === 0).map((v) => v.id);
    const kev = {
      catalogVersion: '2026.09.15',
      vulnerabilities: exploitees.map((id) => ({ cveID: id, vendorProject: 'npm', product: 'x', dateAdded: '2026-09-01' })),
    };

    const sbom = { bomFormat: 'CycloneDX', specVersion: '1.6', components: composants, vulnerabilities: vulns };
    const base = Math.random().toString(36).slice(2, 10);
    const cheminSbom = path.join(dir, `${base}-sbom.json`);
    const cheminKev = path.join(dir, `${base}-kev.json`);
    fs.writeFileSync(cheminSbom, JSON.stringify(sbom, null, 2));
    fs.writeFileSync(cheminKev, JSON.stringify(kev, null, 2));
    const date = `2026-0${1 + alea(8)}-1${alea(9)}T0${alea(9)}:00:00.000Z`;
    cas.push({ sbom: cheminSbom, kev: cheminKev, date, attendu: decisionCra(sbom, new Set(exploitees), date) });
  }
  return cas;
}

// ── Vérifications ───────────────────────────────────────────────────────────

export const m01Checks: Record<string, Check> = {
  // ── Du finding au backlog ─────────────────────────────────────────────────

  'pentest-to-appsec': () => {
    const doc = needYaml<{ classes?: unknown }>('program/backlog.yaml');
    if ('error' in doc) return doc.error;

    const rapport = fixtureJson<RapportPentest>('m01/pentest-report.json');
    const constats = new Map(rapport.constats.map((c) => [c.id, c]));
    const handles = equipeHandles();
    const classes = asArray(asRecord(doc.value).classes).map(asRecord);
    if (classes.length === 0) return 'le backlog ne contient aucune entrée sous la clé `classes`';

    const bad: string[] = [];
    const vus = new Map<string, string>();     // constat → classe qui le revendique
    const equipes = new Set<string>();
    const correctifs = new Set<string>();
    const echeances = new Map<string, { date: string; severite: number }>();

    for (const c of classes) {
      const id = asText(c.classe);
      const exercice = id ? exerciseById(id) : undefined;
      if (!exercice) {
        bad.push(`la classe « ${id || '(sans nom)'} » n’existe pas dans le registre des exercices du lab`);
        continue;
      }

      if (asText(c.cwe).toUpperCase() !== exercice.cwe.toUpperCase()) {
        bad.push(`${id} : la classe est référencée ${exercice.cwe} dans le registre, pas « ${asText(c.cwe) || '(rien)'} »`);
      }
      const fichier = asText(c.fichier);
      if (fichier !== exercice.file) {
        bad.push(`${id} : le fichier qui porte cette classe est \`${exercice.file}\`, pas « ${fichier || '(rien)'} »`);
      } else if (!labExists(fichier)) {
        bad.push(`${id} : \`${fichier}\` n’existe pas dans le dépôt`);
      }

      const listeConstats = asArray(c.constats).map(asText).filter(Boolean);
      if (listeConstats.length === 0) bad.push(`${id} : aucun constat rattaché`);
      let severiteMax = -1;
      for (const ref of listeConstats) {
        const constat = constats.get(ref);
        if (!constat) { bad.push(`${id} : le constat ${ref} ne figure pas dans le rapport`); continue; }
        if (vus.has(ref)) { bad.push(`${ref} est rattaché à deux classes (${vus.get(ref)} et ${id})`); continue; }
        vus.set(ref, id);
        if (CLASSE_DU_CONSTAT[ref] !== id) {
          bad.push(`${ref} (${constat.endpoint}) ne relève pas de ${id} : relis le constat et le code de la route`);
        }
        severiteMax = Math.max(severiteMax, RANG_SEVERITE[constat.severite] ?? 0);
      }

      const correctif = asText(c['correctif-structurel']);
      if (correctif.length < 60) {
        bad.push(`${id} : le correctif structurel tient en moins de 60 caractères — décris l’élimination de la classe, pas le patch`);
      } else if (correctifs.has(correctif)) {
        bad.push(`${id} : le correctif structurel est recopié d’une autre classe`);
      } else correctifs.add(correctif);

      const test = asText(c.test);
      const source = test ? labText(test) : null;
      if (source === null) bad.push(`${id} : le test de régression cité (« ${test || 'rien' } ») n’existe pas dans le dépôt`);
      else if (!source.includes(`describe('${id} ·`) && !source.includes(`describe("${id} ·`)) {
        bad.push(`${id} : \`${test}\` existe mais ne contient aucune suite « ${id} · … » — le test cité ne couvre pas cette classe`);
      }

      const equipe = asText(c.equipe);
      if (!handles.has(equipe)) {
        bad.push(`${id} : « ${equipe || '(rien)'} » n’est pas une équipe de Novafact (voir fixtures/m01/organisation.yaml)`);
      } else equipes.add(equipe);

      const echeance = asText(c.echeance);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(echeance)) bad.push(`${id} : l’échéance doit être une date AAAA-MM-JJ`);
      else if (severiteMax >= 0) echeances.set(id, { date: echeance, severite: severiteMax });
    }

    const oublies = rapport.constats.filter((c) => !vus.has(c.id)).map((c) => c.id);
    if (oublies.length) bad.push(`${oublies.length} constat(s) du rapport ne sont repris nulle part : ${oublies.slice(0, 5).join(', ')}`);

    // Le regroupement est l'objet de l'exercice : une classe par constat n'en
    // est pas un.
    if (classes.length >= rapport.constats.length) {
      bad.push(`${classes.length} classes pour ${rapport.constats.length} constats : rien n’a été regroupé`);
    }
    if (equipes.size < 2) bad.push('toutes les classes sont sur la même équipe — un backlog qui n’est porté par personne en particulier n’est porté par personne');

    // Les délais doivent respecter l'ordre des sévérités : une classe plus
    // grave ne peut pas être promise plus tard qu'une classe moins grave.
    const liste = [...echeances.entries()];
    for (const [a, va] of liste) {
      for (const [b, vb] of liste) {
        if (va.severite > vb.severite && va.date > vb.date) {
          bad.push(`${a} est plus grave que ${b} et pourtant promis plus tard (${va.date} > ${vb.date})`);
        }
      }
    }

    return joined(bad);
  },

  // ── Le gabarit de route qui naît sûr ──────────────────────────────────────

  'paved-road-template': () => {
    const gabarit = needText('templates/route.ts');
    if ('error' in gabarit) return gabarit.error;

    const resultat: RunResult = run(
      'node',
      ['--import', 'tsx', path.join(FIXTURES, 'm01/paved-road/harness.mjs')],
      { timeoutMs: 45_000 },
    );
    if (resultat.timedOut) return 'le banc d’essai n’a pas terminé : le gabarit boucle ou ne répond pas';

    const verdict = lastJson<{ erreur: string | null; cas: { id: string; ok: boolean; detail: string }[] }>(resultat.output);
    if (!verdict) {
      return `le banc d’essai n’a rien pu conclure :\n${resultat.output.slice(0, 600)}`;
    }
    if (verdict.erreur) return verdict.erreur;

    const echecs = verdict.cas.filter((c) => !c.ok).map((c) => `${c.id} : ${c.detail}`);
    return joined(echecs);
  },

  // ── Évaluation de maturité ────────────────────────────────────────────────

  'samm-assessment': () => {
    const relu = relireEvaluation();
    if ('error' in relu) return relu.error;
    const { evaluation } = relu;

    const doc = needYaml<Record<string, unknown>>('program/samm-assessment.yaml');
    if ('error' in doc) return doc.error;
    const racine = asRecord(doc.value);
    const bad: string[] = [];

    // Le score déclaré, flux par flux, doit être celui que donnent les réponses.
    for (const brut of asArray(racine.evaluation)) {
      const e = asRecord(brut);
      const id = asText(e.flux);
      const attendu = evaluation.scoresFlux.get(id);
      if (attendu === undefined) continue;
      const declare = asNumber(e.score);
      if (declare === null) bad.push(`${id} : aucun score déclaré`);
      else if (!proche(declare, attendu)) bad.push(`${id} : score déclaré ${declare}, recalculé ${attendu}`);
    }

    const compare = (cle: string, attendus: Map<string, number>, libelle: string) => {
      const declares = asRecord(racine[cle]);
      for (const [id, attendu] of attendus) {
        const v = asNumber(declares[id]);
        if (v === null) bad.push(`${libelle} ${id} : aucun score déclaré`);
        else if (!proche(v, attendu)) bad.push(`${libelle} ${id} : score déclaré ${v}, recalculé ${attendu}`);
      }
      const inconnus = Object.keys(declares).filter((k) => !attendus.has(k));
      if (inconnus.length) bad.push(`${libelle} inconnu(s) : ${inconnus.join(', ')}`);
    };
    compare('pratiques', evaluation.scoresPratique, 'pratique');
    compare('fonctions', evaluation.scoresFonction, 'fonction');

    const global = asNumber(racine['score-global']);
    if (global === null) bad.push('aucun `score-global` déclaré');
    else if (!proche(global, evaluation.global)) {
      bad.push(`score global déclaré ${global}, recalculé ${evaluation.global}`);
    }

    return joined(bad);
  },

  'samm-roadmap': () => {
    const relu = relireEvaluation();
    if ('error' in relu) {
      return `la feuille de route se dérive de l’évaluation, qui n’est pas exploitable — ${relu.error}`;
    }
    const { evaluation } = relu;

    const doc = needYaml<Record<string, unknown>>('program/roadmap.yaml');
    if ('error' in doc) return doc.error;
    const racine = asRecord(doc.value);
    const bad: string[] = [];

    const seuil = asNumber(racine.seuil);
    if (seuil === null || !proche(seuil, SEUIL_ROADMAP)) {
      bad.push(`le seuil retenu par le challenge est ${SEUIL_ROADMAP} ; la feuille de route déclare « ${racine.seuil ?? 'rien'} »`);
    }

    // Les pratiques sous le seuil, et les flux qui restent à faire progresser.
    const sousLeSeuil = new Set(
      [...evaluation.scoresPratique.entries()].filter(([, s]) => s < SEUIL_ROADMAP).map(([id]) => id),
    );
    const attendus = new Map<string, { pratique: string; niveau: number; activite: string }>();
    for (const fonction of modeleSamm()) {
      for (const pratique of fonction.pratiques) {
        if (!sousLeSeuil.has(pratique.id)) continue;
        for (const flux of pratique.flux) {
          const niveau = niveauAtteint(evaluation.reponses.get(flux.id)!, flux.activites);
          if (niveau >= 3) continue;
          const suivante = flux.activites.find((a) => a.niveau === niveau + 1);
          if (suivante) attendus.set(flux.id, { pratique: pratique.id, niveau, activite: suivante.id });
        }
      }
    }

    const jalons = asArray(racine.jalons).map(asRecord);
    if (jalons.length === 0) return 'la feuille de route ne contient aucun jalon sous la clé `jalons`';

    const couverts = new Set<string>();
    for (const j of jalons) {
      const flux = asText(j.flux);
      const attendu = attendus.get(flux);
      if (!attendu) {
        const connu = tousLesFlux().some((f) => f.flux.id === flux);
        bad.push(connu
          ? `le flux ${flux} n’est pas à traiter : sa pratique est au-dessus du seuil, ou le flux est déjà au niveau 3`
          : `le flux « ${flux || '(sans nom)'} » n’existe pas dans le modèle`);
        continue;
      }
      if (couverts.has(flux)) { bad.push(`le flux ${flux} porte deux jalons`); continue; }
      couverts.add(flux);

      if (asText(j.pratique) !== attendu.pratique) {
        bad.push(`${flux} : la pratique est ${attendu.pratique}, pas « ${asText(j.pratique) || '(rien)'} »`);
      }
      const niveau = asNumber(j['niveau-actuel']);
      if (niveau === null || niveau !== attendu.niveau) {
        bad.push(`${flux} : niveau actuel ${attendu.niveau} d’après l’évaluation, « ${j['niveau-actuel'] ?? 'rien'} » déclaré`);
      }
      if (asText(j.activite) !== attendu.activite) {
        bad.push(`${flux} : le niveau immédiatement supérieur est l’activité ${attendu.activite}, pas « ${asText(j.activite) || '(rien)'} »`);
      }
      if (!/^T[1-4]$/.test(asText(j.echeance))) {
        bad.push(`${flux} : l’échéance doit être un trimestre des douze prochains mois (T1 à T4)`);
      }
    }

    const oublies = [...attendus.keys()].filter((f) => !couverts.has(f));
    if (oublies.length) {
      bad.push(`${oublies.length} flux sous le seuil ne sont pas couverts : ${oublies.slice(0, 5).join(', ')}`);
    }

    return joined(bad);
  },

  // ── La porte qui casse le build ───────────────────────────────────────────

  'break-build-gate': () => {
    const porte = needText('scripts/gate.mjs');
    if ('error' in porte) return porte.error;

    const chemin = path.join(LAB_ROOT, 'workspace/scripts/gate.mjs');
    const bad: string[] = [];

    return withTempDir('novafact-gate-', (dir) => {
      const cas: CasPorte[] = [
        { fichier: path.join(FIXTURES, 'm01/gate/rapport-bloquant.json'), bloquant: true },
        { fichier: path.join(FIXTURES, 'm01/gate/rapport-conforme.json'), bloquant: false },
        ...fabriquerRapports(dir),
      ];

      let bloques = 0;
      let passes = 0;
      for (const c of cas) {
        const r = run('node', [chemin, c.fichier], { timeoutMs: 15_000 });
        if (r.timedOut) { bad.push(`la porte ne termine pas sur ${path.basename(c.fichier)}`); continue; }
        if (c.bloquant) {
          if (r.ok) bad.push(`la porte laisse passer un rapport qui contient une vulnérabilité HIGH ou CRITICAL corrigeable (${path.basename(c.fichier)})`);
          else bloques += 1;
        } else if (!r.ok) {
          bad.push(`la porte bloque un rapport qui ne contient rien de corrigeable en HIGH ou CRITICAL (${path.basename(c.fichier)}) : ${r.output.split('\n')[0].slice(0, 160)}`);
        } else passes += 1;
      }

      // Le double critère, dit explicitement : une porte qui ne fait qu'une des
      // deux moitiés n'est pas une porte.
      if (bad.length === 0 && (bloques === 0 || passes === 0)) {
        bad.push('la porte rend le même verdict partout : elle ne décide rien');
      }
      return joined(bad);
    });
  },

  // ── L'exception qui expire ────────────────────────────────────────────────

  'risk-exception': () => {
    const fichier = needText('osv-scanner.toml');
    if ('error' in fichier) return fichier.error;

    const toml = parseToml(fichier.value);
    const exceptions = toml.IgnoredVulns ?? [];
    const kev = catalogueKev();
    const paquets = paquetsScannes();

    // Ce qui justifie une exception : rien à installer, donc rien à corriger
    // aujourd'hui — et pas d'exploitation connue.
    const attendues = new Set<string>();
    const corrigeables = new Map<string, string>();
    const exploitees = new Set<string>();
    for (const p of paquets) {
      for (const v of p.vulnerabilities) {
        if (kev.has(v.id)) exploitees.add(v.id);
        else if (v.fixed) corrigeables.set(v.id, `${p.package.name} ${v.fixed}`);
        else attendues.add(v.id);
      }
    }

    if (exceptions.length === 0) {
      return 'aucune exception déposée : le fichier ne contient pas de table `[[IgnoredVulns]]` exploitable';
    }

    const bad: string[] = [];
    const vus = new Set<string>();
    const motifs = new Set<string>();
    const maintenant = Date.now();
    const limite = maintenant + 90 * 24 * 3600_000;

    for (const e of exceptions) {
      const id = (e.id ?? '').trim();
      if (!id) { bad.push('une exception n’a pas de champ `id`'); continue; }
      if (vus.has(id)) { bad.push(`${id} fait l’objet de deux exceptions`); continue; }
      vus.add(id);

      if (exploitees.has(id)) {
        bad.push(`${id} figure au catalogue d’exploitation connue : elle ne s’excepte pas, elle se traite`);
        continue;
      }
      if (corrigeables.has(id)) {
        bad.push(`${id} a une version corrigée disponible (${corrigeables.get(id)}) : on la corrige, on ne l’exempte pas`);
        continue;
      }
      if (!attendues.has(id)) {
        bad.push(`${id} n’apparaît dans aucun résultat d’analyse : exception sans objet`);
        continue;
      }

      const motif = (e.reason ?? '').trim();
      if (motif.length < 60) {
        bad.push(`${id} : le motif tient en moins de 60 caractères — une exception non motivée est un abandon`);
      } else if (!motif.includes(id) && !paquets.some((p) => p.vulnerabilities.some((v) => v.id === id) && motif.includes(p.package.name))) {
        bad.push(`${id} : le motif ne mentionne ni la vulnérabilité ni le paquet concerné — il vaut pour n’importe quoi`);
      } else if (motifs.has(motif)) {
        bad.push(`${id} : motif recopié d’une autre exception`);
      } else motifs.add(motif);

      const jusque = (e.ignoreUntil ?? '').trim();
      const t = /^\d{4}-\d{2}-\d{2}/.test(jusque) ? Date.parse(jusque) : NaN;
      if (Number.isNaN(t)) bad.push(`${id} : \`ignoreUntil\` doit porter une date AAAA-MM-JJ`);
      else if (t <= maintenant) bad.push(`${id} : l’exception est déjà expirée (${jusque})`);
      else if (t > limite) bad.push(`${id} : ${jusque} est à plus de quatre-vingt-dix jours — une exception se revoit, elle ne s’oublie pas`);
    }

    const oubliees = [...attendues].filter((id) => !vus.has(id));
    if (oubliees.length) {
      bad.push(`${oubliees.join(', ')} bloque(nt) toujours la CI sans version corrigée ni exception déposée`);
    }

    return joined(bad);
  },

  // ── Attestation adossée au dépôt ──────────────────────────────────────────

  'ssdf-attestation': () => {
    const doc = needYaml<Record<string, unknown>>('program/ssdf.yaml');
    if ('error' in doc) return doc.error;

    const modele = fixtureYaml<{
      taches: { id: string; groupe: string; nom: string }[];
      approfondies: Record<string, string>;
    }>('m01/ssdf-tasks.yaml');
    const attendues = new Map(modele.taches.map((t) => [t.id, t]));

    const STATUTS = new Set(['mis-en-oeuvre', 'partiel', 'non-mis-en-oeuvre', 'non-applicable']);
    const declarees = asArray(asRecord(doc.value).taches).map(asRecord);
    if (declarees.length === 0) return 'l’attestation ne contient aucune entrée sous la clé `taches`';

    const bad: string[] = [];
    const vues = new Set<string>();
    let revendiquees = 0;
    let inapplicables = 0;

    for (const t of declarees) {
      const id = asText(t.id);
      if (!attendues.has(id)) { bad.push(`la tâche « ${id || '(sans nom)'} » n’existe pas dans le référentiel`); continue; }
      if (vues.has(id)) { bad.push(`la tâche ${id} est déclarée deux fois`); continue; }
      vues.add(id);

      const statut = asText(t.statut);
      if (!STATUTS.has(statut)) {
        bad.push(`${id} : « ${statut || '(rien)'} » n’est pas un statut admis (${[...STATUTS].join(' · ')})`);
        continue;
      }

      if (statut === 'non-applicable') {
        inapplicables += 1;
        if (asText(t.justification).length < 40) {
          bad.push(`${id} : « non applicable » demande une justification d’au moins 40 caractères`);
        }
        continue;
      }
      if (statut === 'non-mis-en-oeuvre') continue;

      revendiquees += 1;
      const preuves = asArray(t.preuves).map(asText).filter(Boolean);
      if (preuves.length === 0) { bad.push(`${id} : tâche revendiquée sans aucune preuve`); continue; }

      const absentes = preuves.filter((p) => !labExists(p));
      if (absentes.length) {
        bad.push(`${id} : ${absentes.map((p) => `\`${p}\``).join(', ')} n’existe pas dans le dépôt`);
        continue;
      }

      // Sur un sous-ensemble, on ne se contente pas de l'existence du fichier.
      if (id in modele.approfondies) {
        const contenus = preuves.map((p) => ({ chemin: p, texte: labText(p) ?? '' }));
        const ok = contenus.some(({ chemin, texte }) => {
          const code = stripComments(texte);
          if (id === 'PW.7.2') {
            const routage = /CODEOWNERS$/.test(chemin) && /^\s*[^\s#]+\s+@[\w/-]+/m.test(code);
            const analyse = /\.ya?ml$/.test(chemin) && /(codeql|semgrep|eslint|sonar|zizmor|review|codeowners)/i.test(code);
            return routage || analyse;
          }
          if (id === 'PW.8.2') {
            return /\.ya?ml$/.test(chemin) && /(npm\s+test|npm\s+run\s+(test|verify)|node\s+--test|vitest|jest)/.test(code);
          }
          // RV.1.3
          return /(npm\s+audit|osv-scanner|dependabot|renovate|snyk|trivy)/i.test(code);
        });
        if (!ok) bad.push(`${id} : ${modele.approfondies[id]} — la preuve citée ne l’établit pas`);
      }
    }

    const oubliees = [...attendues.keys()].filter((id) => !vues.has(id));
    if (oubliees.length) {
      bad.push(`${oubliees.length} tâche(s) du référentiel ne sont pas déclarées : ${oubliees.slice(0, 5).join(', ')}`);
    }
    // Les deux raccourcis d'une attestation : tout déclarer hors périmètre, ou
    // ne rien revendiquer du tout.
    if (inapplicables > 3) {
      bad.push(`${inapplicables} tâches déclarées « non applicable » : une attestation dont tout est hors périmètre n’atteste rien`);
    }
    if (revendiquees < 6) {
      bad.push(`seules ${revendiquees} tâches sont revendiquées avec une preuve — cherche dans le dépôt ce qui existe déjà`);
    }

    return joined(bad);
  },

  // ── Le signalement CRA ────────────────────────────────────────────────────

  'cra-notification': () => {
    const script = needText('scripts/cra-report.mjs');
    if ('error' in script) return script.error;

    const chemin = path.join(LAB_ROOT, 'workspace/scripts/cra-report.mjs');
    return withTempDir('novafact-cra-', (dir) => {
      const bad: string[] = [];
      let avecObligation = 0;
      let sansObligation = 0;

      for (const c of fabriquerCasCra(dir)) {
        const r = run('node', [chemin, c.sbom, c.kev, c.date], { timeoutMs: 15_000 });
        const nom = path.basename(c.sbom);
        if (r.timedOut) { bad.push(`le déclencheur ne termine pas sur ${nom}`); continue; }
        if (!r.ok) { bad.push(`le déclencheur a échoué sur ${nom} : ${r.output.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 160) ?? ''}`); continue; }

        const obtenu = lastJson<{ notification?: unknown; obligations?: unknown }>(r.output);
        if (!obtenu) { bad.push(`${nom} : aucune sortie JSON exploitable`); continue; }

        if (Boolean(obtenu.notification) !== c.attendu.notification) {
          bad.push(`${nom} : notification ${c.attendu.notification ? 'due' : 'non due'}, le déclencheur répond ${JSON.stringify(obtenu.notification)}`);
          continue;
        }

        const obligations = asArray(obtenu.obligations).map(asRecord);
        const attendues = c.attendu.obligations as Record<string, string>[];
        if (obligations.length !== attendues.length) {
          bad.push(`${nom} : ${attendues.length} obligation(s) attendue(s), ${obligations.length} rendue(s)`);
          continue;
        }
        for (let i = 0; i < attendues.length; i += 1) {
          const a = attendues[i];
          const o = obligations[i];
          for (const cle of ['composant', 'version', 'vulnerabilite']) {
            if (asText(o[cle]) !== a[cle]) bad.push(`${nom} : ${cle} attendu « ${a[cle]} », rendu « ${asText(o[cle])} »`);
          }
          for (const cle of ['alerteAvant', 'notificationAvant']) {
            const rendu = asText(o[cle]);
            if (Number.isNaN(Date.parse(rendu)) || Date.parse(rendu) !== Date.parse(a[cle])) {
              bad.push(`${nom} : ${cle} attendu ${a[cle]}, rendu « ${rendu || 'rien' } »`);
            }
          }
        }
        if (c.attendu.notification) avecObligation += 1; else sansObligation += 1;
      }

      if (bad.length === 0 && (avecObligation === 0 || sansObligation === 0)) {
        bad.push('le déclencheur rend la même décision partout : il ne décide rien');
      }
      return joined(bad);
    });
  },

  // ── Se comparer plutôt que se noter ───────────────────────────────────────

  'bsimm-compare': () => {
    const doc = needYaml<Record<string, unknown>>('program/bsimm-gap.yaml');
    if ('error' in doc) return doc.error;

    const etude = fixtureYaml<{ activites: { id: string; frequence: number; nom: string }[] }>('m01/bsimm-observed.yaml');
    const connues = new Map(etude.activites.map((a) => [a.id, a]));
    const SEUIL = 60;
    const repandues = etude.activites.filter((a) => a.frequence >= SEUIL).map((a) => a.id);

    const racine = asRecord(doc.value);
    const bad: string[] = [];

    const seuil = asNumber(racine['seuil-frequence']);
    if (seuil === null || seuil !== SEUIL) {
      bad.push(`le seuil retenu par le challenge est ${SEUIL} % ; le livrable déclare « ${racine['seuil-frequence'] ?? 'rien'} »`);
    }

    const declarees = asArray(racine.activites).map(asRecord);
    if (declarees.length === 0) return 'le livrable ne contient aucune entrée sous la clé `activites`';

    const faites = new Map<string, boolean>();
    for (const a of declarees) {
      const id = asText(a.id);
      if (!connues.has(id)) { bad.push(`l’activité « ${id || '(sans nom)'} » n’existe pas dans l’étude`); continue; }
      if (faites.has(id)) { bad.push(`l’activité ${id} est déclarée deux fois`); continue; }

      const fait = asText(a.faite);
      if (fait !== 'oui' && fait !== 'non') {
        bad.push(`${id} : « faite » vaut oui ou non, pas « ${fait || 'rien'} »`);
        continue;
      }
      faites.set(id, fait === 'oui');

      if (fait === 'oui') {
        const preuve = asText(a.preuve);
        if (!preuve) bad.push(`${id} : activité déclarée faite sans preuve`);
        else if (!labExists(preuve)) bad.push(`${id} : la preuve \`${preuve}\` n’existe pas dans le dépôt`);
      }
    }

    const oubliees = repandues.filter((id) => !faites.has(id));
    if (oubliees.length) {
      bad.push(`${oubliees.length} activité(s) observée(s) chez au moins ${SEUIL} % des organisations ne sont pas renseignée(s) : ${oubliees.slice(0, 5).join(', ')}`);
    }
    if (bad.length) return joined(bad);

    // L'écart est CALCULÉ à partir des réponses, il n'est pas déclaré.
    const ecartAttendu = repandues.filter((id) => faites.get(id) === false).sort();
    const ecart = asRecord(racine.ecart);
    const declare = asArray(ecart.activites).map(asText).filter(Boolean).sort();

    if (JSON.stringify(declare) !== JSON.stringify(ecartAttendu)) {
      const enTrop = declare.filter((id) => !ecartAttendu.includes(id));
      const manquants = ecartAttendu.filter((id) => !declare.includes(id));
      if (manquants.length) bad.push(`l’écart oublie ${manquants.join(', ')} : déclarée(s) non faite(s) et pourtant très répandue(s)`);
      if (enTrop.length) bad.push(`l’écart contient ${enTrop.join(', ')}, qui n’est pas dans ce cas`);
    }
    const nombre = asNumber(ecart.nombre);
    if (nombre === null || nombre !== ecartAttendu.length) {
      bad.push(`l’écart compte ${ecartAttendu.length} activité(s), le livrable annonce « ${ecart.nombre ?? 'rien'} »`);
    }

    const priorites = asArray(racine.priorites).map(asText).filter(Boolean);
    if (priorites.length !== 3) bad.push(`trois priorités sont demandées, ${priorites.length} donnée(s)`);
    const horsEcart = priorites.filter((id) => !ecartAttendu.includes(id));
    if (horsEcart.length) bad.push(`${horsEcart.join(', ')} figure en priorité sans être dans l’écart`);

    return joined(bad);
  },
};
