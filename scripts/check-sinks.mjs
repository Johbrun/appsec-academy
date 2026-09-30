// Contrôle du pool de « Spot the Sink ».
//
//   npm run sinks           rapport
//   npm run sinks -- --ci   sort en erreur au moindre problème
//
// Ce qu'il vérifie, et pourquoi :
//
//   · **les indices pointent une ligne existante** — une erreur d'indice rend
//     le challenge injouable, et rien à l'écran ne la signale ;
//   · **la longueur tient le niveau annoncé** — c'est la longueur qui fait la
//     difficulté, pas le nom de la CWE ;
//   · **les N2 et N3 ont un leurre** — sans lui, la ligne se trouve en cherchant
//     la seule chose qui ressemble à un défaut ;
//   · **la bonne CWE figure dans les options**, et il y en a quatre ;
//   · **les identifiants sont uniques**, sinon une série peut servir deux fois
//     le même extrait ;
//   · **chaque CWE employée a un libellé**, sinon le bouton s'affiche vide.
//
// Ce qu'il ne sait PAS juger, et qui se relit à la main : si la ligne désignée
// est bien la bonne, et si les distracteurs sont plausibles pour CE code.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { snippets, cweNames, series, seriesSnippets } = await import(
  path.join(root, 'src/data/sinks/index.ts')
);

const MIN_LINES = { 1: 12, 2: 20, 3: 30 };
const problems = [];

for (const s of snippets) {
  const L = s.code.split('\n');
  const n = L.length;
  const say = (m) => problems.push(`${s.id} : ${m}`);

  if (s.line < 1 || s.line > n) say(`line ${s.line} hors des ${n} lignes`);
  // Un indice qui tombe sur une ligne vide ou sur une accolade seule rend le
  // clic absurde : le joueur ne peut pas deviner ce qu'on attendait de lui.
  else if (!L[s.line - 1].trim()) say(`line ${s.line} désigne une ligne vide`);
  else if (/^[\s{}()\[\];,]*$/.test(L[s.line - 1])) say(`line ${s.line} ne désigne qu’un délimiteur`);
  for (const d of s.decoys ?? []) {
    if (d < 1 || d > n) say(`decoy ${d} hors des ${n} lignes`);
    else if (!L[d - 1].trim()) say(`decoy ${d} désigne une ligne vide`);
    if (d === s.line) say('un leurre désigne la ligne vulnérable');
  }
  if (!s.options.includes(s.cwe)) say('la bonne CWE ne figure pas dans les options');
  if (s.options.length !== 4) say(`${s.options.length} options au lieu de 4`);
  if (new Set(s.options).size !== s.options.length) say('options en double');
  for (const o of s.options) if (!cweNames[o]) say(`${o} n’a pas de libellé`);
  if (s.level >= 2 && !(s.decoys ?? []).length) say(`niveau ${s.level} sans leurre`);
  if (n < MIN_LINES[s.level]) say(`${n} lignes, minimum ${MIN_LINES[s.level]} pour un N${s.level}`);
}

const ids = snippets.map((s) => s.id);
for (const id of new Set(ids)) {
  if (ids.filter((x) => x === id).length > 1) problems.push(`${id} : identifiant en double`);
}

const byLevel = [1, 2, 3].map((l) => snippets.filter((s) => s.level === l).length);
const lines = snippets.map((s) => s.code.split('\n').length);
const avg = lines.length ? (lines.reduce((a, b) => a + b, 0) / lines.length).toFixed(1) : '0';

console.log(`extraits           ${snippets.length}  (N1 ${byLevel[0]} · N2 ${byLevel[1]} · N3 ${byLevel[2]})`);
console.log(`lignes             min ${Math.min(...lines)} · moyenne ${avg} · max ${Math.max(...lines)}`);
console.log(`CWE distinctes     ${new Set(snippets.map((s) => s.cwe)).size}`);

// Une série incomplète n'est pas une erreur de données : c'est un pool encore
// trop étroit pour son profil. On le dit sans faire échouer.
const short = series
  .map((s) => ({ id: s.id, n: seriesSnippets(s.id).length }))
  .filter((s) => s.n < 8);
console.log(`séries complètes   ${series.length - short.length} / ${series.length}`);
if (short.length) console.log(`  incomplètes : ${short.map((s) => `${s.id} (${s.n})`).join(', ')}`);

if (problems.length) {
  console.log('');
  for (const p of problems) console.log('  ✗ ' + p);
}

if (process.argv.includes('--ci')) {
  if (problems.length) {
    console.error(`\n${problems.length} problème(s) dans le pool.`);
    process.exit(1);
  }
  console.log('\nPool conforme.');
}
