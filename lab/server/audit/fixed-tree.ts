// L'arbre corrigé : une copie du lab avec `solutions/` appliqué, servie sur un
// port à part.
//
// Elle existe pour le **double passage**, le motif de correction le plus solide
// du lab : un test de régression produit par l'apprenant doit ÉCHOUER contre le
// code vulnérable et PASSER contre le corrigé. Un test qui passe partout ne
// prouve rien ; un test qui échoue partout casse la fonctionnalité. Les deux
// moitiés ensemble, et seulement elles, prouvent qu'un contrôle a été écrit.
//
// Pourquoi une copie plutôt qu'un simple montage : les fichiers de `solutions/`
// sont des **remplacements**, pas des modules autonomes — ils importent
// `../store.ts`, qui n'existe pas à côté d'eux. Les exécuter sur place est
// impossible ; les copier par-dessus l'arbre vivant casserait le lab de
// l'apprenant pendant qu'il travaille.

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LAB_ROOT, run } from './workspace.ts';

/** Ce qu'on ne recopie jamais : lourd, régénérable, ou propre à l'apprenant. */
const SKIP = new Set(['node_modules', 'dist', '.git', 'workspace', 'solutions', '.vite']);

const TREE = path.join(os.tmpdir(), 'novafact-lab-fixed');
const FIXED_PORT = Number(process.env.LAB_FIXED_PORT ?? 4417);
const FIXED_IMDS_PORT = FIXED_PORT + 1;

export const FIXED_API = `http://127.0.0.1:${FIXED_PORT}/api`;

function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

/** Le plus récent des mtimes de l'arbre, pour savoir si la copie est périmée. */
function newest(dir: string, skip = SKIP): number {
  let latest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    latest = Math.max(latest, entry.isDirectory() ? newest(full, skip) : fs.statSync(full).mtimeMs);
  }
  return latest;
}

/**
 * Prépare (ou rafraîchit) l'arbre corrigé et renvoie son chemin.
 *
 * La copie est mise en cache : la refaire à chaque vérification coûterait
 * plusieurs secondes pour rien. Elle est refaite dès qu'un fichier du lab ou du
 * corrigé est plus récent qu'elle.
 */
export function prepareFixedTree(): string {
  const stamp = path.join(TREE, '.built-at');
  const builtAt = fs.existsSync(stamp) ? Number(fs.readFileSync(stamp, 'utf8')) : 0;
  const source = Math.max(newest(LAB_ROOT), newest(path.join(LAB_ROOT, 'solutions'), new Set()));

  if (builtAt >= source) return TREE;

  fs.rmSync(TREE, { recursive: true, force: true });
  copyTree(LAB_ROOT, TREE);
  // Le corrigé par-dessus : ce sont des remplacements, aux mêmes chemins.
  copyTree(path.join(LAB_ROOT, 'solutions'), TREE);
  // Les dépendances ne sont pas recopiées — un lien suffit et évite d'installer.
  const modules = path.join(TREE, 'node_modules');
  if (!fs.existsSync(modules)) fs.symlinkSync(path.join(LAB_ROOT, 'node_modules'), modules, 'junction');
  fs.writeFileSync(stamp, String(Date.now()));
  return TREE;
}

let server: ChildProcess | null = null;

/** Attend que le serveur corrigé réponde, ou abandonne. */
async function waitUntilUp(timeoutMs = 20_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${FIXED_API}/health`, { signal: AbortSignal.timeout(800) });
      if (res.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Démarre le serveur corrigé s'il ne tourne pas déjà, et renvoie son URL d'API.
 * Il reste en vie entre deux vérifications : le démarrage coûte plus cher que
 * la mémoire qu'il occupe.
 */
export async function startFixedServer(): Promise<string | null> {
  if (server && !server.killed && (await waitUntilUp(1500))) return FIXED_API;

  const tree = prepareFixedTree();
  server = spawn('node', ['--import', 'tsx', path.join(tree, 'server/index.ts')], {
    cwd: tree,
    stdio: 'ignore',
    detached: false,
    env: {
      ...process.env,
      LAB_PORT: String(FIXED_PORT),
      LAB_IMDS_PORT: String(FIXED_IMDS_PORT),
    },
  });
  server.on('exit', () => { server = null; });

  return (await waitUntilUp()) ? FIXED_API : null;
}

export function stopFixedServer(): void {
  server?.kill();
  server = null;
}

/**
 * Le double passage.
 *
 * Exécute le fichier de test produit par l'apprenant contre le code vulnérable,
 * puis contre le corrigé, en pointant `LAB_API` sur l'un puis l'autre.
 *
 * Renvoie `null` quand le couple est correct, sinon la raison — en distinguant
 * les deux échecs, qui ont des causes opposées et appellent des corrections
 * opposées.
 */
export async function doublePass(
  testFile: string,
  opts: { timeoutMs?: number; vulnerableApi?: string } = {},
): Promise<string | null> {
  if (!fs.existsSync(testFile)) return `le fichier de test \`${testFile}\` n’existe pas`;

  const vulnerable = opts.vulnerableApi ?? `http://127.0.0.1:${process.env.LAB_PORT ?? 4317}/api`;
  const exec = (api: string) =>
    run('node', ['--import', 'tsx', '--test', testFile], {
      timeoutMs: opts.timeoutMs ?? 60_000,
      cwd: LAB_ROOT,
      env: { LAB_API: api },
    });

  const against = exec(vulnerable);
  if (against.timedOut) return 'le test ne termine pas contre le code livré (délai dépassé)';
  if (against.ok) {
    return 'le test passe déjà contre le code vulnérable : il ne vérifie donc pas le contrôle, seulement que la route répond';
  }

  const fixedApi = await startFixedServer();
  if (!fixedApi) return 'le serveur de référence n’a pas démarré — impossible de faire le second passage';

  const fixed = exec(fixedApi);
  if (fixed.timedOut) return 'le test ne termine pas contre le corrigé (délai dépassé)';
  if (!fixed.ok) {
    return `le test échoue aussi contre le corrigé : il casse la fonctionnalité légitime au lieu de vérifier le contrôle\n${fixed.output.slice(0, 600)}`;
  }
  return null;
}
