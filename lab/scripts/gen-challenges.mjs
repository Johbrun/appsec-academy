// Génère CHALLENGES.md et ROADMAP.md depuis shared/exercises.ts.
//
// Le catalogue est écrit une seule fois, dans le registre. Ce script en dérive
// la documentation, pour qu'elle ne puisse pas diverger.
//
//   npm run challenges              écrit les deux fichiers
//   node … gen-challenges.mjs --check   échoue s'ils ne correspondent plus
//
// `npm run verify` lance la seconde forme.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSiteCatalog } from './site-catalog.mjs';
import {
  DEFAULT_SITE_URL,
  exercises,
  lessonLabel,
  lessonTitles,
  lessonUrl,
  moduleTitles,
} from '../shared/exercises.ts';
import { plannedExercises } from '../shared/planned/index.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CSSLP = {
  D1: 'Concepts', D2: 'Cycle de vie', D3: 'Exigences', D4: 'Architecture',
  D5: 'Implémentation', D6: 'Tests', D7: 'Déploiement & exploitation', D8: 'Supply chain',
};

const KIND = {
  exploit: { mark: '', label: 'exploit' },
  fix: { mark: ' ⚙', label: 'fix' },
  artifact: { mark: ' ✎', label: 'artifact' },
};

const all = [...exercises, ...plannedExercises];
const modNum = (m) => Number(m.slice(1));
const modLabel = (m) => `M${modNum(m)}`;
const byModule = (a, b) => modNum(a) - modNum(b);
const niv = (n) => `N${n}`;

// Ancre explicite sur l'identifiant. Les slugs déduits d'un titre accentué et
// ponctué diffèrent d'un moteur Markdown à l'autre, et les liens du sommaire
// cassent alors en silence.
const anchor = (e) => e.id;

const lessonLink = (ref) =>
  `[${lessonLabel(ref)}](${lessonUrl(ref)}) · [source](../src/content/${ref}.mdx)`;

function mkWriter() {
  const lines = [];
  const w = (s = '') => lines.push(s);
  w.done = () => lines.join('\n');
  return w;
}

// ── CHALLENGES.md ───────────────────────────────────────────────────────────

const c = mkWriter();

c('# Challenges du Novafact Lab');
c();
c('> Généré depuis `shared/exercises.ts` par `npm run challenges` — ne pas éditer à la main.');
c('>');
c('> ⚠ **Application volontairement vulnérable.** Boucle locale, données fictives. Voir [README.md](README.md).');
c();
c(`**${exercises.length} challenges jouables**, et **${plannedExercises.length} spécifiés** dans la`);
c('[feuille de route](ROADMAP.md). Chaque leçon renvoie au site lancé en local');
c(`(\`npm run dev\` à la racine du site, ${DEFAULT_SITE_URL}) et à sa source \`.mdx\` pour une lecture hors ligne.`);
c();
c('Trois familles de challenges :');
c();
c('- **exploit** — on atteint l’objectif par des requêtes, et le serveur constate lui-même la violation d’invariant ;');
c('- **fix** ⚙ — le défaut est dans un artefact du dépôt (workflow, Terraform, Dockerfile, politique IAM). Il n’y a');
c('  rien à exploiter depuis le navigateur : on l’audite et on le corrige, et c’est la correction qui est vérifiée ;');
c('- **artifact** ✎ — on **produit** un fichier (une règle, un test, un document VEX, un modèle de menaces) et c’est');
c('  ce fichier qui est jugé. C’est ce qui rend praticables les domaines qui résistent autrement.');
c();
c('Deux motifs de correction tiennent ces challenges, et aucun autre n’est aussi solide. Le **double passage** :');
c('l’artefact doit échouer contre le code vulnérable et passer contre `solutions/` — un test qui passe partout ne');
c('prouve rien, un test qui échoue partout casse la fonctionnalité. Et le **différentiel valide/invalide** : ce qui');
c('est écrit est exécuté contre des jeux que le harnais détient, ce qui interdit de coder le résultat en dur.');
c();
c('Un challenge jouable se valide quand **le serveur constate lui-même** la violation. Vient ensuite le vrai');
c('travail : corriger, puis `npm run verify`, qui exige que l’attaque échoue **et** que la fonctionnalité légitime');
c('marche encore. Le corrigé est dans [SOLUTIONS.md](SOLUTIONS.md).');
c();

c('## Les challenges jouables');
c();
c('| # | Challenge | Mod. | Niv. | CWE | CSSLP | Leçon de référence |');
c('| --- | --- | --- | --- | --- | --- | --- |');
exercises.forEach((e, i) => {
  const ref = e.lessons[0];
  c(`| ${i + 1} | [${e.title}](#${anchor(e)}) | ${modLabel(e.module)} | ${niv(e.level)} | ${e.cwe} | ${e.csslp.join(', ')} | [${lessonLabel(ref)}](${lessonUrl(ref)}) |`);
});
c();

for (const m of [...new Set(exercises.map((e) => e.module))].sort(byModule)) {
  c(`## ${moduleTitles[m] ?? m}`);
  c();
  for (const e of exercises.filter((x) => x.module === m)) {
    c(`<a id="${anchor(e)}"></a>`);
    c();
    c(`### ${e.title}`);
    c();
    c([
      `**${niv(e.level)}**`,
      e.cwe,
      ...e.csslp.map((d) => `${d} ${CSSLP[d]}`),
      ...(e.k ?? []).map((k) => `Kohnfelder K${k}`),
    ].join(' · '));
    c();
    c(e.brief);
    c();
    c(`**Objectif.** ${e.goal}`);
    c();
    c(`**Où.** \`${e.file}\``);
    c();
    c('**Dans le cours.**');
    for (const ref of e.lessons) c(`- ${lessonLink(ref)}`);
    c();
    c('<details>');
    c('<summary>La classe de bugs à éliminer (spoiler)</summary>');
    c();
    c(e.fix);
    c();
    c(`Détail et code corrigé : [SOLUTIONS.md](SOLUTIONS.md) · [\`solutions/${e.file}\`](solutions/${e.file})`);
    c('</details>');
    c();
  }
}

c('## Couverture');
c();
c('### Par domaine CSSLP');
c();
c('| Domaine | Jouables | À venir | Total |');
c('| --- | --- | --- | --- |');
for (const [d, label] of Object.entries(CSSLP)) {
  const live = exercises.filter((e) => e.csslp.includes(d)).length;
  const soon = plannedExercises.filter((e) => e.csslp.includes(d)).length;
  if (!live && !soon) continue;
  c(`| ${d} ${label} | ${live} | ${soon} | ${live + soon} |`);
}
c();

c('### Par module');
c();
c('| Module | Jouables | À venir |');
c('| --- | --- | --- |');
for (const m of [...new Set(all.map((e) => e.module))].sort(byModule)) {
  const live = exercises.filter((e) => e.module === m).length;
  const soon = plannedExercises.filter((e) => e.module === m).length;
  c(`| ${moduleTitles[m] ?? m} | ${live || '—'} | ${soon || '—'} |`);
}
c();

c('### Par chapitre de *Designing Secure Software*');
c();
c('| Chapitre | Challenges |');
c('| --- | --- |');
for (const k of [...new Set(all.flatMap((e) => e.k ?? []))].sort((a, b) => a - b)) {
  c(`| K${k} | ${all.filter((e) => (e.k ?? []).includes(k)).map((e) => e.title).join(', ')} |`);
}
c();

const catalog = readSiteCatalog();
const uncovered = [];
if (catalog) {
  const hits = new Map();
  for (const e of all) {
    for (const ref of e.lessons) {
      if (!hits.has(ref)) hits.set(ref, []);
      hits.get(ref).push(e);
    }
  }
  const total = catalog.reduce((n, m) => n + m.lessons.length, 0);
  const covered = catalog.reduce((n, m) => n + m.lessons.filter((l) => hits.has(l.ref)).length, 0);

  c('### Par leçon');
  c();
  c(`**${covered} des ${total} leçons** du parcours sont rattachées à au moins un challenge.`);
  c();
  for (const m of catalog) {
    const n = m.lessons.filter((l) => hits.has(l.ref)).length;
    for (const l of m.lessons) if (!hits.has(l.ref)) uncovered.push({ m, l });
    c('<details>');
    c(`<summary><strong>M${m.num} · ${m.title}</strong> — ${n}/${m.lessons.length} leçons couvertes</summary>`);
    c();
    c('| Leçon | Challenges |');
    c('| --- | --- |');
    for (const l of m.lessons) {
      const items = hits.get(l.ref) ?? [];
      const cell = items.length
        ? items.map((e) => (e.status === 'live' ? `[${e.title}](#${e.id})` : `${e.title} *(à venir)*`)).join('<br>')
        : '—';
      c(`| [${l.title}](${lessonUrl(l.ref)}) | ${cell} |`);
    }
    c();
    c('</details>');
    c();
  }
}

c('## Ce que le lab ne couvre pas, et pourquoi');
c();
if (uncovered.length) {
  c('Ces leçons n’ont aucun challenge, et c’est délibéré. Une seule des raisons est technique.');
  c();
  c('| Leçon | Raison |');
  c('| --- | --- |');
  const why = {
    'm02/l07': 'Les Server Actions et les composants serveur n’existent pas sur un socle Express + Vite. Simuler leurs CVE enseignerait une fiction.',
    'm03/l05': 'Le request smuggling demande une vraie chaîne de proxys dont les analyseurs HTTP divergent. Le simuler en local donnerait une fausse intuition du mécanisme.',
    'm06/l03': 'Négocier avec une équipe produit se juge sur l’issue d’un échange humain. Le jeu Pushback du site le travaille déjà.',
    'm06/l04': 'Traduire un risque technique en risque métier repose sur des estimations d’expert — précisément le jugement qu’on voudrait évaluer.',
  };
  for (const { m, l } of uncovered) {
    c(`| **M${m.num}** · [${l.title}](${lessonUrl(l.ref)}) | ${why[l.ref] ?? 'Sujet de jugement ou d’animation : traité par les jeux du site.'} |`);
  }
  c();
}
c('Plus généralement : **les scénarios cloud exécutés** restent chez CloudGoat, TerraGoat et Stratus Red Team. Le');
c('lab n’en prend que la partie qui vit dans le dépôt — politiques IAM, Terraform, Dockerfile, workflows — parce');
c('que c’est là que le défaut est introduit et que le correctif se relit.');
c();
c(`Tous ces labs sont listés dans la page [Labs](${DEFAULT_SITE_URL}/#/labs) du site.`);
c();

// ── ROADMAP.md ──────────────────────────────────────────────────────────────

const r = mkWriter();

r('# Feuille de route du Novafact Lab');
r();
r('> Généré depuis `shared/planned/` par `npm run challenges` — ne pas éditer à la main.');
r();
r(`**${plannedExercises.length} challenges spécifiés, pas encore implémentés.** Les challenges jouables sont dans`);
r('[CHALLENGES.md](CHALLENGES.md), avec la couverture par leçon et ce que le lab ne couvre pas.');
r();
r('Écrire la spécification avant le code a une raison : c’est elle qui dit si un challenge a sa place ici. Un');
r('défaut qui ne peut être ni exploité par une requête, ni constaté sur un artefact du dépôt, ni produit comme');
r('livrable vérifiable n’est pas un exercice de lab — c’est un jeu ou un atelier, et sa place est sur le site.');
r();
r('Ils vivent dans `shared/planned/`, un fichier par module, séparés du registre jouable : l’API, l’interface et');
r('les tests de régression les ignorent. Les en-têtes de ces fichiers portent les réserves d’implémentation —');
r('formats non confirmés, outils absents de npm, instabilités connues — à lever avant d’écrire le code.');
r();
r('Légende : ⚙ *fix* (corriger un artefact du dépôt) · ✎ *artifact* (produire un livrable). Sans marque : *exploit*.');
r();

for (const m of [...new Set(plannedExercises.map((e) => e.module))].sort(byModule)) {
  const items = plannedExercises.filter((e) => e.module === m);
  r(`## ${moduleTitles[m] ?? m}`);
  r();
  r('| Challenge | Niv. | CWE | Objectif | Dans le cours |');
  r('| --- | --- | --- | --- | --- |');
  for (const e of items) {
    const refs = e.lessons.map((x) => `[${lessonLabel(x)}](${lessonUrl(x)})`).join('<br>');
    r(`| **${e.title}**${KIND[e.kind].mark} | ${niv(e.level)} | ${e.cwe} | ${e.goal} | ${refs} |`);
  }
  r();
  r('<details>');
  r(`<summary>Détail des ${items.length} challenges de ce module</summary>`);
  r();
  for (const e of items) {
    const tags = [`\`${e.file}\``, KIND[e.kind].label, ...e.csslp];
    if ((e.k ?? []).length) tags.push(`K${(e.k ?? []).join(', K')}`);
    r(`**${e.title}** — ${tags.join(' · ')}`);
    r();
    r(e.brief);
    r();
    r(`*Classe à éliminer.* ${e.fix}`);
    r();
  }
  r('</details>');
  r();
}

// ── Écriture ────────────────────────────────────────────────────────────────

const outputs = [
  { file: 'CHALLENGES.md', content: c.done() },
  { file: 'ROADMAP.md', content: r.done() },
];

if (process.argv.includes('--check')) {
  const stale = outputs
    .filter(({ file, content }) => {
      const target = path.join(root, file);
      return !fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content;
    })
    .map((s) => s.file);
  if (stale.length) {
    console.error(`${stale.join(' et ')} ne correspond plus au registre. Lance : npm run challenges`);
    process.exit(1);
  }
  console.log('CHALLENGES.md et ROADMAP.md à jour.');
} else {
  for (const { file, content } of outputs) fs.writeFileSync(path.join(root, file), content);
  console.log(
    `Écrits — CHALLENGES.md (${exercises.length} jouables), ROADMAP.md (${plannedExercises.length} à venir), ` +
      `${Object.keys(lessonTitles).length} leçons reliées.`,
  );
}
