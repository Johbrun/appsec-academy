# AppSec Academy

Parcours complet de sécurité applicative pour l'écosystème JavaScript et AWS : 20 modules, jeux pédagogiques, labs reconnus, progression et badges. Même design que l'ATT&CK SaaS Academy.

## Lancer

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build statique dans dist/
```

## Contenu

- `PROGRAMME.md` : le programme complet (modules, leçons, jeux, sources, grille CSSLP, intégration Kohnfelder et PortSwigger).
- `src/data/catalog.ts` : les 20 modules et leurs leçons (titre, niveau, domaines CSSLP). Source de vérité du parcours.
- `src/content/<module>/<leçon>.mdx` : le texte des leçons. Une leçon sans fichier s'affiche « en rédaction ».
- `src/data/games.ts` et `src/data/game-*.ts` : la liste des jeux et leurs scénarios.
- `src/data/labs.ts`, `src/data/library.ts` : labs reconnus et bibliothèque de sources.
- `lab/` : **Novafact Lab**, l'application volontairement vulnérable qui accompagne le parcours (`lab/README.md`, 74 challenges jouables dans `lab/CHALLENGES.md`, feuille de route dans `lab/ROADMAP.md`).

## Écrire une leçon

Un fichier MDX par leçon. Il exporte ses questions de validation, puis utilise les composants de `src/components/mdx.tsx` :

````mdx
export const questions = [
  { q: "…", options: ["…", "…"], answer: 1, explain: "…" },
];

<YouKnow>Rappel côté offensif, replié par défaut.</YouKnow>

## Un titre

<Diff file="apps/api/src/routes/auth.ts" hlBefore="3" hlAfter="3-6">

```ts
// version vulnérable
```

```ts
// version corrigée
```

</Diff>

<Callout kind="novafact">…</Callout>
<Lab id="ps-nosql" />
<Recap items={["…"]} />
<Sources items={[{ title: "…", url: "https://…" }]} />
````

Les blocs de code passent toujours par des blocs Markdown (MDX supprime l'indentation dans les attributs JSX). Une leçon est validée quand toutes ses questions sont justes ; un module l'est quand toutes ses leçons le sont.

## Le lab

`lab/` contient Novafact rendue exécutable et volontairement vulnérable — même stack que le site. 17 exercices
sur M2, M3, M4, M10 et M19.

```bash
cd lab && npm install && npm run dev   # http://127.0.0.1:5199
```

Les 74 challenges jouables sont dans [`lab/CHALLENGES.md`](lab/CHALLENGES.md) et les 221 spécifiés dans
[`lab/ROADMAP.md`](lab/ROADMAP.md), chacun relié aux leçons qui le traitent — 158 des 162 leçons du parcours
sont couvertes. Un exercice se valide quand le serveur constate lui-même la violation d'invariant. Vient ensuite le vrai
travail : corriger, puis `npm run verify`, qui exige que l'attaque échoue **et** que la fonctionnalité légitime
marche encore. Le lab ne tourne que sur la boucle locale et refuse de démarrer en production.

## Qualité des quiz

Un quiz dont la bonne réponse est toujours la plus longue ne teste rien : on le réussit sans lire la question.
`npm run quiz` mesure trois règles — la bonne réponse ne dépasse pas de plus de 25 % le plus long distracteur,
elle n'est la plus longue que dans moins de 40 % des cas, et aucune explication ne cite un rang d'option.
`npm run check` les fait échouer la vérification.

Les options sont **mélangées à l'affichage**, leçons comme examens : la position n'est pas un indice, et
retenter une leçon rebat les cartes.

Ce que le contrôle ne sait pas juger, et qui se relit à la main : la plausibilité d'un distracteur. Une option
absurde passe les trois règles et ruine quand même la question. Un bon distracteur est une position
défendable en apparence, fausse pour une raison qu'on peut nommer.

## Progression

XP, niveaux, badges, scores et répétition espacée sont stockés dans le `localStorage` du navigateur. La page Profil permet d'exporter et de restaurer la progression en JSON.

Contenu pédagogique non officiel. OWASP, MITRE ATT&CK®, CSSLP® (ISC2) et Burp Suite (PortSwigger) sont des marques de leurs détenteurs respectifs.
