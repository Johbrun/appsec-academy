// Livrable de référence — challenge break-build-gate (M1).
//
// La porte de contrôle de la CI. Deux moitiés, et il faut les deux :
//
//   · elle BLOQUE quand une vulnérabilité de sévérité HIGH ou CRITICAL dispose
//     d'une version corrigée — c'est-à-dire quand quelqu'un peut agir tout de
//     suite ;
//   · elle LAISSE PASSER le reste, y compris une CRITICAL sans correctif
//     publié. Non parce que ce n'est pas grave, mais parce qu'une porte qui
//     bloque sur ce que personne ne peut corriger se fait désactiver dans la
//     semaine. Ce cas-là passe par une exception datée — challenge
//     risk-exception.
//
// Une porte qui bloque toujours n'est pas une porte, c'est un mur ; une porte
// qui ne bloque jamais n'est pas une porte, c'est un affichage.

import fs from 'node:fs';

const SEVERITES_BLOQUANTES = new Set(['HIGH', 'CRITICAL']);

const chemin = process.argv[2];
if (!chemin) {
  console.error('usage : node gate.mjs <rapport.json>');
  process.exit(2);
}

let rapport;
try {
  rapport = JSON.parse(fs.readFileSync(chemin, 'utf8'));
} catch (err) {
  console.error(`rapport illisible : ${err.message}`);
  process.exit(2);
}

const constats = (rapport.results ?? [])
  .flatMap((r) => r.packages ?? [])
  .flatMap((p) =>
    (p.vulnerabilities ?? []).map((v) => ({
      paquet: p.package?.name ?? '?',
      version: p.package?.version ?? '?',
      id: v.id,
      severite: String(v.severity ?? '').toUpperCase(),
      corrige: v.fixed ?? null,
    })),
  );

const bloquants = constats.filter((c) => SEVERITES_BLOQUANTES.has(c.severite) && c.corrige);
const differes = constats.filter((c) => SEVERITES_BLOQUANTES.has(c.severite) && !c.corrige);

for (const c of bloquants) {
  console.error(`BLOQUE  ${c.severite.padEnd(8)} ${c.id}  ${c.paquet}@${c.version} → ${c.corrige}`);
}
for (const c of differes) {
  console.log(`DIFFÉRÉ ${c.severite.padEnd(8)} ${c.id}  ${c.paquet}@${c.version} — aucune version corrigée, exception requise`);
}

if (bloquants.length > 0) {
  console.error(`\n${bloquants.length} vulnérabilité(s) corrigeable(s) de sévérité haute ou critique : la porte bloque.`);
  process.exit(1);
}

console.log(`Porte franchie : ${constats.length} constat(s), aucun corrigeable en sévérité haute ou critique.`);
process.exit(0);
