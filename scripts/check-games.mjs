// Contrôle de qualité des jeux à options.
//
// Même défaut que sur les quiz, et pour la même raison : quand la bonne réponse
// est systématiquement la plus longue, le jeu se gagne sans lire le scénario.
// Le code, les journaux, la politique IAM ne servent plus à rien — on compte
// les caractères. Ce script mesure ça et le refuse.
//
//   npm run games           rapport complet
//   npm run games -- --ci   sort en erreur si un seuil est dépassé
//
// Trois règles :
//
//   · **par jeu d'options** — la bonne réponse ne doit pas dépasser de plus de
//     25 % le plus long des distracteurs. Même si elle reste la plus longue,
//     elle ne l'est pas assez pour se repérer d'un coup d'œil.
//
//   · **par jeu** — elle ne doit être la plus longue que dans une minorité de
//     cas. Le hasard donnerait 33 % sur trois options, 25 % sur quatre ; on
//     tolère 40 %, au-delà c'est un biais systématique.
//
//   · **couverture du pool** — un jeu qui tire 5 manches dans un pool de 5
//     montre tout son contenu à la première partie. Rejouer ne teste plus que
//     la mémoire. Au-delà de 70 % du pool consommé par partie, on le signale.
//
// Ce que le script ne sait PAS juger, et qu'il faut relire à la main : la
// plausibilité d'un distracteur, et les indices qui ne sont pas de longueur —
// un jeu où la bonne réponse est toujours celle qui propose un compromis se
// gagne à la forme, avec des options parfaitement calibrées.
//
// Inutile de surveiller le rang de la bonne réponse : tous les composants
// mélangent les options à l'affichage (`shuffle` dans src/games/*.tsx), donc
// l'ordre du fichier n'est jamais celui que le joueur voit.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(root, 'src/data') + '/';

/** Tolérance de longueur de la bonne réponse face au plus long distracteur. */
const MAX_RATIO = 1.25;
/** Part maximale de jeux d'options où la bonne réponse est la plus longue. */
const MAX_LONGEST_SHARE = 0.4;
/** Part maximale du pool consommée par une partie. */
const MAX_COVERAGE = 0.7;

const load = (f) => import(D + f);
const len = (s) => String(s ?? '').length;

/**
 * Le catalogue. Chaque entrée dit où sont les options d'un jeu et laquelle est
 * la bonne — la convention diffère d'un fichier à l'autre (`right`, `holds`,
 * le maximum de `points`, ou « la première du tableau »).
 */
const GAMES = [
  { file: 'game-patches.ts', name: 'patches', rounds: 6,
    sets: (m) => m.patchScenarios.map((s) => ({ opts: s.options, right: (o) => o.holds, text: (o) => o.label + ' ' + (o.code ?? '') })) },
  { file: 'game-races.ts', name: 'races', rounds: 8,
    sets: (m) => m.raceScenarios.flatMap((s) => ['outcomes', 'fixes'].map((k) => ({ opts: s[k], right: (o) => o.right, text: (o) => o.label }))) },
  { file: 'game-parsers.ts', name: 'parsers', rounds: 7,
    sets: (m) => m.parserScenarios.flatMap((s) => ['divergence', 'impact', 'fix'].map((k) => ({ opts: s[k], right: (o) => o.right, text: (o) => o.text }))) },
  { file: 'game-stones.ts', name: 'stones', rounds: 5,
    sets: (m) => m.stoneScenarios.map((s) => { const mx = Math.max(...s.fixes.map((f) => f.points)); return { opts: s.fixes, right: (o) => o.points === mx, text: (o) => o.label }; }) },
  { file: 'game-pushback.ts', name: 'pushback', rounds: 8,
    sets: (m) => m.scenes.map((s) => ({ opts: s.replies, right: (o) => o.points === 2, text: (o) => o.text })) },
  { file: 'game-findings.ts', name: 'findings', rounds: 6,
    sets: (m) => m.findings.map((f) => ({ opts: f.reasons, right: (_o, i) => i === 0, text: (o) => o })) },
  { file: 'game-oauth.ts', name: 'oauth', rounds: 6,
    sets: (m) => m.flowScenarios.map((s) => ({ opts: s.fixes, right: (_o, i) => i === 0, text: (o) => o })) },
  { file: 'game-pathfinder.ts', name: 'pathfinder', rounds: 7,
    sets: (m) => m.pathAudits.map((a) => ({ opts: a.fixes, right: (_o, i) => i === 0, text: (o) => o })) },
  { file: 'game-crisis.ts', name: 'crisis', rounds: 1,
    sets: (m) => m.crises.flatMap((c) => c.decisions.map((d) => ({ opts: d.choices, right: (o) => o.quality === 2, text: (o) => o.label }))) },
  { file: 'game-logs.ts', name: 'logs', rounds: 6,
    sets: (m) => m.logCases.map((c) => ({ opts: [c.attack, ...c.attackOptions], right: (_o, i) => i === 0, text: (o) => o })) },
  { file: 'game-datamap.ts', name: 'datamap', rounds: 8,
    sets: (m) => m.dataItems.map((d) => ({ opts: d.controls, right: (_o, i) => i === d.best, text: (o) => o })) },
  { file: 'game-triage.ts', name: 'triage', rounds: 1,
    sets: (m) => Object.values(m.sprints).map((sp) => ({ opts: sp.plans, right: (o) => o.right, text: (o) => o.text })) },
  { file: 'game-supply.ts', name: 'supply', rounds: 4,
    sets: (m) => m.incidents.map((i) => ({ opts: i.controls, right: (_o, k) => k === 0, text: (o) => o })) },
];

// `rounds` est la taille de la plus grande série du jeu : depuis les séries, une
// partie ne tire plus au hasard dans tout le pool, elle joue une série.

/**
 * La taille du pool et le nombre de manches jouées. `rounds: null` veut dire
 * que le composant joue tout le pool — la couverture est alors de 100 %.
 */
const POOLS = {
  patches: (m) => m.patchScenarios.length,
  races: (m) => m.raceScenarios.length,
  parsers: (m) => m.parserScenarios.length,
  stones: (m) => m.stoneScenarios.length,
  pushback: (m) => m.scenes.length,
  findings: (m) => m.findings.length,
  oauth: (m) => m.flowScenarios.length,
  pathfinder: (m) => m.pathAudits.length,
  crisis: (m) => m.crises.length,
  logs: (m) => m.logCases.length,
  supply: (m) => m.incidents.length,
  datamap: (m) => m.dataItems.length,
  triage: (m) => Object.keys(m.sprints).length,
};

const problems = [];
const warnings = [];
const rows = [];

for (const g of GAMES) {
  const mod = await load(g.file);
  const sets = g.sets(mod).filter((s) => s.opts && s.opts.length >= 2);
  let longest = 0;
  const ratios = [];

  for (const [n, s] of sets.entries()) {
    const k = s.opts.findIndex((o, i) => s.right(o, i));
    if (k < 0) { problems.push(`${g.name} · jeu ${n + 1} : aucune bonne réponse`); continue; }
    const lens = s.opts.map((o) => len(s.text(o)));
    const good = lens[k];
    const others = lens.filter((_, i) => i !== k);
    const worst = Math.max(...others);
    const ratio = good / worst;
    ratios.push(ratio);
    if (good >= worst) longest += 1;
    if (ratio > MAX_RATIO) {
      problems.push(
        `${g.name} · jeu ${n + 1} : la bonne réponse fait ${good} caractères contre ${worst} `
        + `pour le plus long distracteur (${ratio.toFixed(2)}×) — « ${String(s.text(s.opts[k])).slice(0, 60)}… »`,
      );
    }
  }

  const share = sets.length ? longest / sets.length : 0;
  if (share > MAX_LONGEST_SHARE) {
    problems.push(
      `${g.name} : la bonne réponse est la plus longue dans ${longest} jeux sur ${sets.length} `
      + `(${Math.round(share * 100)} %, plafond ${MAX_LONGEST_SHARE * 100} %)`,
    );
  }

  const pool = POOLS[g.name](mod);
  const rounds = g.rounds ?? pool;
  const coverage = Math.min(rounds, pool) / pool;
  if (coverage > MAX_COVERAGE) {
    warnings.push(
      `${g.name} : ${rounds} manches pour ${pool} scénarios (${Math.round(coverage * 100)} % du pool) `
      + '— une partie montre presque tout le contenu',
    );
  }

  const avg = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  rows.push({ name: g.name, sets: sets.length, share, avg, rounds, pool, coverage });
}

// ── Séries ──────────────────────────────────────────────────────────────────
//
// Chaque jeu se joue par séries (sous-modules de difficulté, `src/lib/series.ts`).
// On retrouve les séries de chaque fichier de données par leur forme — un objet
// avec `list` et `items` — et on exige :
//
//   · au moins MIN_SERIES séries par jeu ;
//   · aucune série vide, aucune série identique à une autre ;
//   · au moins deux niveaux affichés, pour qu'il y ait une progression.

import fs from 'node:fs';

/** Nombre minimal de séries par jeu. */
const MIN_SERIES = 5;

const dataFiles = [
  ...fs.readdirSync(D).filter((f) => /^game-.*\.ts$/.test(f)),
  ...fs.readdirSync(D, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(D, e.name, 'index.ts')))
    .map((e) => `${e.name}/index.ts`),
];

// Chaque jeu passe par l'écran de séries : directement (`SeriesGame`) ou via
// la mécanique d'audit ligne à ligne (`LineAudit`), qui s'appuie dessus. Un jeu
// ajouté sans séries retomberait sur un tirage au hasard dans tout le pool.
const G = path.join(root, 'src/games');
for (const f of fs.readdirSync(G).filter((f) => f.endsWith('.tsx'))) {
  const src = fs.readFileSync(path.join(G, f), 'utf8');
  if (!/\b(SeriesGame|LineAudit)\b/.test(src)) problems.push(`src/games/${f} : le jeu ne passe pas par l'écran de séries`);
}

const seriesRows = [];
for (const f of dataFiles) {
  const mod = await load(f);
  for (const [name, v] of Object.entries(mod)) {
    if (!v || typeof v !== 'object' || !Array.isArray(v.list) || typeof v.items !== 'function') continue;
    const where = `${f} · ${name}`;
    const sigs = new Map();
    for (const s of v.list) {
      const ids = v.items(s.id).map((it) => it.id);
      if (!ids.length) problems.push(`${where} : la série « ${s.id} » est vide`);
      if (!s.shuffleEachTime) {
        const sig = [...ids].sort().join('|');
        if (sigs.has(sig)) problems.push(`${where} : « ${s.id} » a exactement le contenu de « ${sigs.get(sig)} »`);
        else sigs.set(sig, s.id);
      }
    }
    if (v.list.length < MIN_SERIES) problems.push(`${where} : ${v.list.length} séries, il en faut au moins ${MIN_SERIES}`);
    const levels = new Set(v.list.map((s) => s.level));
    if (levels.size < 2) problems.push(`${where} : toutes les séries ont le même niveau (N${[...levels][0]})`);
    seriesRows.push({
      where, n: v.list.length,
      levels: [1, 2, 3].map((l) => v.list.filter((s) => s.level === l).length).join('/'),
      sizes: v.list.map((s) => s.count).join(' '),
    });
  }
}

const pct = (x) => `${Math.round(x * 100)} %`;
console.log('jeu'.padEnd(13) + 'options'.padStart(8) + '+longue'.padStart(9) + 'ratio'.padStart(8) + 'manches'.padStart(9) + 'couverture'.padStart(12));
for (const r of rows) {
  console.log(
    r.name.padEnd(13)
    + String(r.sets).padStart(8)
    + pct(r.share).padStart(9)
    + r.avg.toFixed(2).padStart(8)
    + `${r.rounds}/${r.pool}`.padStart(9)
    + pct(r.coverage).padStart(12),
  );
}

console.log('');
console.log('séries'.padEnd(44) + 'n'.padStart(4) + '  N1/N2/N3   tailles');
for (const r of seriesRows) console.log(r.where.padEnd(44) + String(r.n).padStart(4) + '  ' + r.levels.padEnd(10) + ' ' + r.sizes);

if (warnings.length) {
  console.log('');
  for (const w of warnings) console.log('  ~ ' + w);
}
if (problems.length) {
  console.log('');
  for (const p of problems) console.log('  ✗ ' + p);
}

if (process.argv.includes('--ci')) {
  if (problems.length) {
    console.error(`\n${problems.length} problème(s) dans les jeux.`);
    process.exit(1);
  }
  console.log('\nJeux conformes.');
}
