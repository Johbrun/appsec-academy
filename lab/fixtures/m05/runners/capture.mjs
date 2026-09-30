// Lance un script de l'apprenant et met sa sortie standard dans un fichier.
//
//   node capture.mjs <sortie.json> <script.mjs> [args…]
//
// Pourquoi ce détour : le harnais borne à quelques milliers de caractères ce
// qu'il relit d'un processus fils, ce qui suffit pour expliquer un échec mais
// pas pour relire un document produit. Le fils capture donc la sortie complète
// et l'écrit sur disque ; le harnais ne lit ici qu'un verdict d'une ligne.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [, , sortie, script, ...args] = process.argv;
if (!sortie || !script) {
  process.stdout.write(JSON.stringify({ ok: false, erreur: 'usage : capture.mjs <sortie> <script> [args…]' }));
  process.exit(0);
}

try {
  const texte = execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  fs.writeFileSync(sortie, texte);
  process.stdout.write(JSON.stringify({ ok: true, octets: Buffer.byteLength(texte) }));
} catch (err) {
  const e = /** @type {{ stdout?: string, stderr?: string, message?: string, signal?: string }} */ (err);
  const detail = `${e.stderr ?? ''}${e.stdout ?? ''}`.trim() || e.message || 'échec inconnu';
  process.stdout.write(
    JSON.stringify({
      ok: false,
      expire: e.signal === 'SIGTERM',
      erreur: detail.split('\n').filter(Boolean).slice(-4).join(' · ').slice(0, 600),
    }),
  );
}
