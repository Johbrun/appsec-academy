# AppSec Academy

Site de formation AppSec (JS + AWS) : blocs A à H qui suivent le SSDLC, leçons MDX, jeux, examens, progression. Tout est en français. Le dossier parent `mitre/` contient d'autres projets (`../src`, `../pse`) : ne pas les confondre avec celui-ci. Le dépôt git est `appsec/` seul.

## Carte du code

| Où | Quoi |
| --- | --- |
| `src/` | Front Vite + React 18 + TypeScript (routes dans `pages/`, jeux dans `games/`, données dans `data/`) |
| `src/content/<mXX>/<lXX>.mdx` | Une leçon par fichier. Composants MDX dans `src/components/mdx.tsx` |
| `src/data/catalog.ts` | Modules et leçons : **source de vérité du parcours** (cahier des charges : `PROGRAMME.md`) |
| `server/` | API Express 5 + SQLite (`better-sqlite3`), sessions, argon2id, promos/enseignants. Tests dans `server/test/` |
| `scripts/check-*.mjs` | Garde-fous de contenu (quiz, jeux, sinks, MDX) |
| `lab/` | **Novafact Lab** : app volontairement vulnérable, projet npm séparé (Express 4, son propre `node_modules`) |

Node ≥ 22 (`.nvmrc`). Pas de linter ni de formateur configurés : ne reformate pas l'existant, imite le style du fichier.

## Avant de dire « terminé »

```bash
npm run check                       # tsc front + tsc serveur + quiz + sinks + jeux + tests serveur
node scripts/check-mdx.mjs [chemin] # si tu touches une leçon ou mdx.tsx — PAS dans `check`
(cd lab && npm run check)           # si tu touches lab/
```

`npm run check` doit rester vert ; ne jamais affaiblir un seuil, un test ou un `--ci` pour le faire passer. Un contrôle qui gêne est un signal : corrige le contenu, pas le contrôle. Pour l'UI, lance `npm run dev:all` et regarde la page : la compilation ne prouve pas que ça s'affiche.

## Règles de contenu (ce que les scripts ne jugent pas)

- **Leçons** : denses, ~1 300-1 700 mots hors questions (médiane actuelle ≈ 1 630 ; `check-mdx` affiche le compte). Elles suivent le fil de `PROGRAMME.md` §1 : ce que tu sais déjà → ce qui change côté AppSec → dans le code (vulnérable → corrigé, avec le payload qui casse le mauvais correctif).
- **Cas réels** : ancre régulièrement leçons et jeux dans des incidents/CVE documentés (`<Callout kind="case">`). Vérifie chaque fait (date, CVE, mécanisme) à la source et cite-la dans `<Sources>`. N'invente jamais un incident ni un chiffre ; en cas de doute, dis-le plutôt que d'affirmer.
- **Kohnfelder** (*Designing Secure Software*) : reformulé et référencé par chapitre (`k` dans le catalogue), jamais recopié. Les PDF à la racine du dépôt parent sont des sources, pas du contenu à citer tel quel.
- **Questions de quiz** : un bon distracteur est défendable en apparence et faux pour une raison qu'on peut nommer. Une option absurde passe les scripts et ruine la question. La bonne réponse ne doit pas être repérable à sa longueur, et l'explication ne cite jamais un rang (« la 2e option ») : les options sont mélangées à l'affichage.
- **Chiffres en dur** : évite d'écrire « N leçons / N challenges » à la main. Ces nombres ont déjà divergé entre `README.md`, `lab/README.md` et `lab/CHALLENGES.md`. Préfère une formulation sans chiffre, ou le chiffre généré.

## Invariants mécaniques à préserver

Ces scripts dupliquent des listes du code ; les oublier fait échouer ou, pire, contourner le contrôle en silence.

- **Nouveau composant MDX ou nouveau `kind` de `Callout`** → l'ajouter aussi dans `known` / `kinds` de `scripts/check-mdx.mjs`.
- **`export const questions = [ … \n];`** : garde ce format littéral, `check-mdx` l'extrait par regex. Une `Lab id` doit exister dans `src/data/labs.ts` (lu par regex aussi : ne change pas la forme des `id:` / `ps('…')` sans adapter le script).
- **Nouveau jeu à options** → l'ajouter à `GAMES` **et** `POOLS` dans `scripts/check-games.mjs` (catalogue en dur : un jeu absent n'est jamais contrôlé), et mélanger les options à l'affichage (`shuffle`).
- **Séries** : tout jeu passe par `SeriesGame` (`src/components/Series.tsx`) avec au moins cinq séries `defineSeries` exportées depuis son fichier de données (`check-games` le vérifie). Ajouter des items = leur donner `id` stable et `level`. Les records de série sont des clés `jeu:série` dans `scores` : tout code qui compte les jeux (`server/summary.ts`, badges) doit les ignorer.
- **Séries exigées par une leçon** : `lessonGames` dans `catalog.ts` (un ou deux jeux, séries désignées par leur `id`, jamais par leur rang ; chaque jeu disponible exigé par au moins une leçon), réussies à `SERIES_PASS` (`store/progress.tsx`). Nouveau jeu → entrée dans `src/data/series-index.ts`. `check-games` vérifie les deux ; renommer l'`id` d'une série exigée casse la leçon.
- **Sinks** (`src/data/sinks/pool-*.ts`) : `check-sinks` vérifie les numéros de ligne, les leurres et les longueurs par niveau, pas que la ligne désignée est *la bonne*. Relis à la main.
- **Nouvelle leçon** = entrée `L(...)` dans `catalog.ts` + fichier `.mdx`. Une leçon sans fichier s'affiche « en rédaction » ; ce n'est pas une erreur.
- **Module** : son `id` (`mXX`) est stable et sert de clé partout (progression, cartes `m02-c7`, labs, jeux) ; seul `num` (numéro affiché) suit l'ordre du tableau. Un module qui a une leçon rédigée doit avoir son diagnostic dans `src/data/checkpoints.ts` (`check-quiz`).
- **Déplacer ou renuméroter une leçon** change sa clé de progression `mXX-lYY` : table de correspondance dans `src/store/migrate.ts` et nouveau format de progression (sinon un onglet resté sur l'ancienne version réécrit les anciennes clés). Les renvois « M8, leçon 6 » des textes et du lab sont à réécrire (`lab/shared` puis `npm run challenges`).

## Serveur : il doit tenir ce qu'il enseigne

- **Toute route de l'API a une ligne** dans `server/test/security/authz-matrix.test.ts` (statut attendu par type d'acteur). Un test de complétude échoue sinon : ajoute la ligne dans le même commit que la route.
- Écritures : `csrfGuard` (origine connue + `application/json`) ; corps lu via `bodyOf`/`integer` de `server/lib/http.ts`, jamais `req.body` brut ; requêtes SQL **toujours paramétrées** ; erreurs métier via `HttpError`. Un objet d'un autre propriétaire répond 404, pas 403.
- **Migrations** : ajouter `server/migrations/00N_*.sql`, ne jamais modifier une migration déjà appliquée.
- **CSP sans `'unsafe-inline'`** : pas de `<script>` ni `style=` en ligne dans `index.html` (le script de thème est `public/theme.js`) ; pas de `dangerouslySetInnerHTML` ni `innerHTML` dans le code applicatif.
- La config échoue vite en production (`PUBLIC_ORIGIN`, `DATABASE_PATH`) : garde ce comportement, ne mets pas de valeur par défaut « pratique » en production. Pas de secret dans le code ni dans les logs ; `data/` (base SQLite) et `*.pdf` sont ignorés par git.
- Tests : `node:test` via `tsx`, horloge injectable (`clock`) plutôt que des `sleep`. Un correctif de sécurité arrive avec un test qui vérifie que l'attaque **échoue** et que le cas légitime **marche encore**. Les tests du dossier `security/` ne se suppriment pas pour faire passer un changement.
- Imports : `.ts` explicite dans `server/`, sans extension dans `src/`. TypeScript `strict` + `noUnusedLocals` : pas de `any` ni de `@ts-ignore` pour contourner.

## Le lab (`lab/`)

- Il est **vulnérable exprès**, en boucle locale, et refuse de démarrer avec `NODE_ENV=production` (`lab/server/safety.ts`). Ne le rends jamais accessible depuis l'extérieur, n'y mets aucune donnée réelle, ne copie pas son code dans `server/` ou `src/`.
- **Ne corrige pas une faille du lab « au passage »** : c'est le support d'un exercice. Les corrigés vivent dans `lab/solutions/` et `lab/SOLUTIONS.md`.
- `npm run verify` échoue sur le code livré **par conception** : ce n'est pas une régression. Un challenge ajouté doit échouer avant correction et passer avec `solutions/` (double passage).
- `lab/CHALLENGES.md` est **généré** depuis `lab/shared/exercises.ts` : modifie la source puis `cd lab && npm run challenges`, jamais le `.md` à la main.
- `lab/workspace/` contient les livrables personnels des apprenants (ignorés par git).

## Style

- Commentaires en français, qui disent **pourquoi** (la contrainte, le piège évité), pas ce que fait la ligne. Garde la densité du voisinage : en-têtes de fichier explicatifs pour les scripts et modèles de données, peu de commentaires dans les composants.
- Textes d'interface et messages d'erreur en français ; identifiants de code en anglais, sauf ceux du domaine pédagogique déjà en français (`CarteDuParcours`, `YouKnow`…).
- Commits : préfixe gitmoji (`/commit`). Un changement de comportement du serveur, un nouveau jeu ou une nouvelle leçon = un commit cohérent, pas un mélange.
