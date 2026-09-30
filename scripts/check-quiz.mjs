// Contrôle de qualité des questions de quiz.
//
// Un quiz dont la bonne réponse est toujours la plus longue ne teste rien : on
// le réussit sans lire la question. C'est ce que ce script mesure et refuse.
//
//   npm run quiz           rapport complet
//   npm run quiz -- --ci   sort en erreur si le seuil est dépassé
//
// Deux règles, et elles se complètent :
//
//   · **par question** — la bonne réponse ne doit pas dépasser de plus de 25 %
//     le plus long des distracteurs. C'est la règle qui tue l'indice de forme :
//     même si la bonne réponse est la plus longue, elle ne l'est pas *assez*
//     pour se repérer d'un coup d'œil.
//
//   · **globalement** — la bonne réponse ne doit être la plus longue que dans
//     une minorité de questions. Le hasard donnerait 25 % sur quatre options ;
//     on tolère jusqu'à 40 %, au-delà c'est un biais systématique.
//
// Ce que le script ne sait PAS juger, et qu'il faut relire à la main : la
// plausibilité d'un distracteur. Une option absurde (« demander un nouveau
// pentest dans six mois ») passe ces règles et ruine pourtant la question.
//
// Ce qu'il est inutile de surveiller, en revanche : le rang de `answer`. Les
// options sont mélangées à l'affichage (LessonPage et Exams), donc l'indice
// stocké n'est jamais celui que l'apprenant voit. Équilibrer les rangs dans le
// fichier ne sert à rien — et les équilibrer PARFAITEMENT (chaque rang une fois
// par leçon) serait même un biais si l'ordre n'était pas mélangé, puisque trois
// réponses donneraient la quatrième.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(root, 'src/content');

/** Tolérance de longueur de la bonne réponse par rapport au plus long distracteur. */
const MAX_RATIO = 1.25;
/** Part maximale de questions où la bonne réponse est la plus longue. */
const MAX_LONGEST_SHARE = 0.4;

/** Formules qui trahissent la bonne réponse ou paressent sur les distracteurs. */
const BANNED = [
  /toutes? les (réponses|propositions)/i,
  /aucune? des/i,
  /^rien de tout/i,
];

/**
 * Les options sont mélangées à l'affichage (LessonPage et Exams) : la position
 * n'est plus stable, donc une explication qui y renvoie ment à l'apprenant.
 * Elle doit nommer le contenu de l'option, pas son rang.
 */
const POSITIONAL = /\b(première|deuxième|seconde|troisième|quatrième|dernière)\s+(option|réponse|proposition)/i;

export function parseQuestions(source) {
  const start = source.indexOf('export const questions');
  if (start < 0) return [];
  const end = source.slice(start).search(/\n\];/);
  const block = end < 0 ? source.slice(start) : source.slice(start, start + end + 3);

  const out = [];
  const re = /q:\s*(["'])((?:\\.|(?!\1).)*)\1[\s\S]*?options:\s*\[([\s\S]*?)\],\s*\n\s*answer:\s*(\d+),\s*\n\s*explain:\s*(["'])((?:\\.|(?!\5).)*)\5/g;
  let m;
  while ((m = re.exec(block))) {
    const raw = m[3];
    const options = [...raw.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)].map((o) => o[2]);
    if (options.length >= 2) out.push({ q: m[2], options, answer: Number(m[4]), explain: m[6] ?? '' });
  }
  return out;
}

function lessons() {
  const out = [];
  for (const mod of fs.readdirSync(CONTENT).sort()) {
    const dir = path.join(CONTENT, mod);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort()) {
      out.push({ ref: `${mod}/${file.replace('.mdx', '')}`, path: path.join(dir, file) });
    }
  }
  return out;
}

const problems = [];
let total = 0;
let longest = 0;
const perModule = new Map();

/**
 * Les mêmes règles, quelle que soit la provenance des questions : celles des
 * leçons, extraites du MDX, et celles des diagnostics de module, qui vivent
 * dans `src/data/checkpoints.ts`. Un diagnostic se réussit à la forme aussi
 * bien qu'un quiz — et il mesurerait alors l'astuce de l'apprenant plutôt que
 * ce que le module lui a appris.
 */
function auditQuestions(ref, questions, stat) {
  questions.forEach((question, index) => {
    const { options, answer } = question;
    if (answer >= options.length) {
      problems.push(`${ref} q${index + 1} : answer=${answer} hors des ${options.length} options`);
      return;
    }
    total += 1;
    stat.total += 1;

    const lengths = options.map((o) => o.length);
    const correct = lengths[answer];
    const others = lengths.filter((_, i) => i !== answer);
    const longestOther = Math.max(...others);

    if (correct === Math.max(...lengths)) { longest += 1; stat.longest += 1; }
    if (correct > longestOther * MAX_RATIO) {
      stat.over += 1;
      problems.push(
        `${ref} q${index + 1} : la bonne réponse fait ${correct} signes contre ${longestOther} ` +
          `au plus long distracteur (×${(correct / longestOther).toFixed(1)})`,
      );
    }
    options.forEach((o, i) => {
      const hit = BANNED.find((rx) => rx.test(o));
      if (hit) problems.push(`${ref} q${index + 1} option ${i + 1} : formule à bannir (${hit})`);
    });
    if (POSITIONAL.test(question.explain ?? '')) {
      problems.push(
        `${ref} q${index + 1} : l’explication renvoie à un rang d’option, or l’ordre est mélangé à l’affichage`,
      );
    }
  });
}

for (const lesson of lessons()) {
  const mod = lesson.ref.split('/')[0];
  const stat = perModule.get(mod) ?? { total: 0, longest: 0, over: 0 };
  auditQuestions(lesson.ref, parseQuestions(fs.readFileSync(lesson.path, 'utf8')), stat);
  perModule.set(mod, stat);
}

// ── Les diagnostics d'entrée et de sortie ───────────────────────────────────
const { checkpoints } = await import(path.join(root, 'src/data/checkpoints.ts'));
let diagnostics = 0;
for (const [mod, questions] of Object.entries(checkpoints)) {
  const stat = perModule.get(mod) ?? { total: 0, longest: 0, over: 0 };
  auditQuestions(`${mod}/diagnostic`, questions, stat);
  perModule.set(mod, stat);
  diagnostics += questions.length;
}

const share = total ? longest / total : 0;
const overLength = problems.filter((p) => p.includes('signes contre')).length;
const positional = problems.filter((p) => p.includes('rang d’option')).length;

console.log(`questions          ${total}  (dont ${diagnostics} de diagnostic)`);
console.log(`bonne réponse la plus longue   ${longest} (${(share * 100).toFixed(0)} %, seuil ${MAX_LONGEST_SHARE * 100} %)`);
console.log(`trop longues (>×${MAX_RATIO})        ${overLength}`);
console.log(`explications qui citent un rang  ${positional}`);

if (process.argv.includes('--by-module')) {
  console.log('\npar module :');
  for (const [mod, s] of [...perModule].sort()) {
    if (!s.total) continue;
    console.log(`  ${mod}  ${String(s.total).padStart(3)} questions · ${String(s.longest).padStart(3)} plus longues · ${String(s.over).padStart(3)} hors seuil`);
  }
}

if (process.argv.includes('--list')) {
  console.log('');
  for (const p of problems.slice(0, Number(process.env.LIMIT ?? 40))) console.log('  ' + p);
  if (problems.length > 40) console.log(`  … et ${problems.length - 40} autres`);
}

if (process.argv.includes('--ci')) {
  const failed = overLength > 0 || positional > 0 || share > MAX_LONGEST_SHARE;
  if (failed) {
    console.error('\nLes quiz se réussissent encore à la forme. Relance avec --list pour le détail.');
    process.exit(1);
  }
  console.log('\nQuiz conformes.');
}
