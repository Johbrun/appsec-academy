// Banc d'essai de M7 — il démarre un lab à lui, sur un port à lui.
//
// Deux vérifications de ce module ont besoin de l'application EN MARCHE : la
// carte des données, qu'on confronte à ce que les routes renvoient vraiment, et
// la matrice de traçabilité, qui exige que les tests cités passent.
//
// Pourquoi un serveur à part plutôt que celui de l'apprenant : une
// vérification s'exécute DANS le serveur du lab, de façon synchrone. Un
// processus fils qui irait interroger ce serveur-là attendrait une réponse que
// personne ne peut écrire — le serveur est bloqué dans la vérification. Le
// banc d'essai démarre donc sa propre instance, sur un port libre, et la tue en
// partant.
//
//   node --import tsx fixtures/m07/harness.mjs champs
//   node --import tsx fixtures/m07/harness.mjs tests <fichier.test.ts> …
//
// Il écrit un unique objet JSON sur la sortie standard, en dernière ligne.

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const LAB_ROOT = path.resolve(import.meta.dirname, '../..');
const PORT = 4700 + Math.floor(Math.random() * 250);
const API = `http://127.0.0.1:${PORT}/api`;

const fin = (objet) => { console.log(JSON.stringify(objet)); process.exit(0); };

const serveur = spawn('node', ['--import', 'tsx', path.join(LAB_ROOT, 'server/index.ts')], {
  cwd: LAB_ROOT,
  stdio: 'ignore',
  env: { ...process.env, LAB_PORT: String(PORT), LAB_IMDS_PORT: String(PORT + 500), NO_COLOR: '1' },
});
const arreter = () => { try { serveur.kill(); } catch { /* déjà parti */ } };
process.on('exit', arreter);

async function attendre(msMax = 30_000) {
  const limite = Date.now() + msMax;
  while (Date.now() < limite) {
    try {
      const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(800) });
      if (res.ok) return true;
    } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

if (!(await attendre())) fin({ erreur: 'le banc d’essai n’a pas réussi à démarrer une instance du lab' });

const mode = process.argv[2];

if (mode === 'champs') {
  // ── Les champs que l'API expose réellement ────────────────────────────────
  let jeton = null;
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dev@acme.example', password: 'dev' }),
    });
    jeton = (await res.json())?.token ?? null;
  } catch { /* on sonde quand même les routes publiques */ }

  const ROUTES = [
    '/me', '/invoices', '/invoices/INV-1001', '/credits', '/settings', '/clients', '/export',
  ];

  const champs = new Set();
  const servies = [];
  const recolter = (valeur, profondeur = 0) => {
    if (profondeur > 6 || valeur === null || typeof valeur !== 'object') return;
    if (Array.isArray(valeur)) { for (const v of valeur) recolter(v, profondeur + 1); return; }
    for (const [cle, v] of Object.entries(valeur)) {
      champs.add(cle);
      recolter(v, profondeur + 1);
    }
  };

  for (const route of ROUTES) {
    try {
      const res = await fetch(`${API}${route}`, {
        headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const texte = await res.text();
      recolter(JSON.parse(texte));
      servies.push(route);
    } catch { /* route absente ou non JSON : on passe */ }
  }

  arreter();
  fin({ erreur: null, champs: [...champs].sort(), routes: servies });
}

if (mode === 'tests') {
  // ── Les tests cités, rejoués contre cette instance ────────────────────────
  const fichiers = process.argv.slice(3);
  const resultats = {};

  for (const fichier of fichiers) {
    const r = spawnSync('node', ['--import', 'tsx', '--test', '--test-reporter=tap', fichier], {
      cwd: LAB_ROOT,
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, LAB_API: API, NO_COLOR: '1' },
    });
    const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const verdicts = {};
    for (const ligne of sortie.split('\n')) {
      const m = ligne.match(/^\s*(not ok|ok)\s+\d+\s+-\s+(.*?)\s*$/);
      if (!m) continue;
      const nom = m[2].replace(/\s*#\s*(SKIP|TODO).*$/i, '').trim();
      if (!nom) continue;
      // Une suite échoue dès qu'un de ses tests échoue : on garde le pire.
      verdicts[nom] = (verdicts[nom] ?? true) && m[1] === 'ok';
    }
    resultats[fichier] = {
      verdicts,
      demarre: sortie.includes('TAP version') || Object.keys(verdicts).length > 0,
      sortie: sortie.slice(0, 500),
    };
  }

  arreter();
  fin({ erreur: null, resultats });
}

arreter();
fin({ erreur: `mode inconnu : ${mode}` });
