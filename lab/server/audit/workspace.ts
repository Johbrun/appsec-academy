// Espace de travail de l'apprenant.
//
// Les challenges « artifact » ne demandent pas de corriger un fichier existant :
// ils demandent d'en **produire** un — une règle de lint, un test de
// régression, un document VEX, un modèle de menaces. Ce module donne aux
// vérifications une vue de ce que l'apprenant a écrit, et de quoi l'exécuter.
//
// Deux motifs de correction, et aucun autre n'est aussi solide :
//
//   · le **double passage** — le test produit doit ÉCHOUER contre le code
//     vulnérable et PASSER contre `solutions/`. Un test qui passe partout ne
//     prouve rien ; un test qui échoue partout casse la fonctionnalité.
//
//   · le **différentiel valide/invalide** — la règle produite est exécutée
//     contre des jeux que le harnais détient : une dizaine de cas à signaler,
//     une dizaine de cas très proches à ne pas signaler. Trop large, elle
//     échoue sur les seconds ; trop étroite, sur les premiers. C'est ce qui
//     interdit de coder le résultat en dur.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
export const LAB_ROOT = path.resolve(here, '../..');
export const WORKSPACE = path.join(LAB_ROOT, 'workspace');

/** Un livrable attendu, résolu dans l'espace de travail. */
function resolveIn(root: string, rel: string): string | null {
  const full = path.resolve(root, rel);
  // Garde-fou : une vérification ne lit jamais hors de l'espace qu'elle juge.
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

export function wsText(rel: string): string | null {
  const full = resolveIn(WORKSPACE, rel);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return fs.readFileSync(full, 'utf8');
}

export const wsExists = (rel: string) => wsText(rel) !== null;
export const wsPath = (rel: string) => resolveIn(WORKSPACE, rel);

export function wsJson<T = unknown>(rel: string): { value: T } | { error: string } | null {
  const raw = wsText(rel);
  if (raw === null) return null;
  try {
    return { value: JSON.parse(raw) as T };
  } catch (err) {
    return { error: `n’est pas du JSON valide (${(err as Error).message.split('\n')[0]})` };
  }
}

export function wsYaml<T = unknown>(rel: string): { value: T } | { error: string } | null {
  const raw = wsText(rel);
  if (raw === null) return null;
  try {
    return { value: (loadYaml(raw) ?? {}) as T };
  } catch (err) {
    return { error: `n’est pas du YAML valide (${(err as Error).message.split('\n')[0]})` };
  }
}

/**
 * Message standard pour un livrable absent. Uniforme d'un challenge à l'autre :
 * l'apprenant doit savoir où écrire sans relire l'énoncé.
 */
export const missing = (rel: string) => `le livrable \`workspace/${rel}\` n’existe pas encore`;

// ── Exécution ───────────────────────────────────────────────────────────────

export interface RunResult {
  ok: boolean;
  /** Sortie fusionnée, tronquée : elle sert à expliquer un échec, pas à tout rejouer. */
  output: string;
  timedOut: boolean;
}

/**
 * Exécute une commande bornée dans le temps.
 *
 * L'apprenant exécute son propre code sur sa propre machine — c'est l'objet de
 * l'exercice. Le délai maximal est là pour qu'une règle pathologique ou une
 * boucle infinie ne bloque pas le lab, pas pour isoler du code hostile.
 */
export function run(
  cmd: string,
  args: string[],
  opts: {
    cwd?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
    /**
     * La sortie est tronquée, parce qu'elle finit souvent dans un message
     * d'erreur lu par un humain. Quand on attend du JSON, il faut relever la
     * limite : une matrice qui cite trois fichiers de test produit un verdict
     * de plusieurs dizaines de milliers de caractères, et une troncature au
     * milieu rend le JSON illisible — la vérification échouerait alors sur un
     * livrable correct.
     */
    maxOutput?: number;
  } = {},
): RunResult {
  const max = opts.maxOutput ?? 4000;
  try {
    const output = execFileSync(cmd, args, {
      cwd: opts.cwd ?? LAB_ROOT,
      timeout: opts.timeoutMs ?? 30_000,
      encoding: 'utf8',
      maxBuffer: Math.max(max * 4, 1024 * 1024),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', ...opts.env },
    });
    return { ok: true, output: String(output).slice(0, max), timedOut: false };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; signal?: string; message?: string };
    const timedOut = e.signal === 'SIGTERM';
    const output = `${e.stdout ?? ''}${e.stderr ?? ''}` || e.message || '';
    return { ok: false, output: String(output).slice(0, max), timedOut };
  }
}

/**
 * Le double passage n'est PAS encore implémenté, et c'est délibéré.
 *
 * Il exige de lancer le test produit contre deux versions du code : l'arbre
 * livré et l'arbre corrigé. Or `solutions/` contient des remplacements destinés
 * à être copiés par-dessus, pas à s'exécuter sur place — ses fichiers importent
 * `../store.ts`, qui n'existe pas à côté d'eux. Il faut donc préparer un arbre
 * temporaire avec le corrigé appliqué, y lancer un second serveur, et pointer
 * le test sur l'un puis l'autre.
 *
 * Sept challenges en dépendent (les tests de régression, les propriétés, le
 * fuzz). Les quatre-vingts autres se jugent par schéma, par recalcul, par
 * lookup ou par confrontation au code — d'où l'ordre choisi : ceux-là d'abord.
 *
 * En attendant, une vérification qui en aurait besoin doit le dire plutôt que
 * de juger à moitié.
 */
export const doublePassUnavailable =
  'le double passage (test rejoué contre le code vulnérable puis contre le corrigé) n’est pas encore outillé dans ce lab';
