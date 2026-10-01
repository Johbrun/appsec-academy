# AppSec Academy

Parcours complet de sécurité applicative pour l'écosystème JavaScript et AWS : des blocs qui suivent le cycle de développement sécurisé, jeux pédagogiques, labs reconnus, progression et badges. Même design que l'ATT&CK SaaS Academy.

C'est un **monolithe** : un serveur Express sert le site, gère les comptes et enregistre la progression dans SQLite. Les étudiants ont un compte, les enseignants suivent leurs promos.

## Lancer

Node 22 (`.nvmrc`).

```bash
npm install
npm run dev:all      # serveur (4300) + Vite (5173) : ouvre http://localhost:5173
```

`dev:all` lance `dev:server` (API, base dans `data/appsec.db`) et `dev` (Vite, qui relaie `/api` vers le serveur). Pour le site tel qu'il sera servi en production :

```bash
npx vite build && npm start      # http://127.0.0.1:4300
```

`npm run build` enchaîne `tsc -b` puis Vite ; le typage est aussi vérifié par `npm run check`.

## Contenu

- `PROGRAMME.md` : le programme complet (modules, leçons, jeux, sources, grille CSSLP, intégration Kohnfelder et PortSwigger).
- `src/data/catalog.ts` : les blocs, les modules et leurs leçons (titre, niveau, domaines CSSLP). Source de vérité du parcours.
- `src/content/<module>/<leçon>.mdx` : le texte des leçons. Une leçon sans fichier s'affiche « en rédaction ».
- `src/data/games.ts` et `src/data/game-*.ts` : la liste des jeux et leurs scénarios.

## Les jeux se jouent par séries

Chaque jeu s'ouvre sur un choix de **séries** (au moins cinq), comme Spot the Sink : un titre, ce qui change
d'une série à l'autre, un niveau N1 à N3 et le record du joueur. Les items du pool sont notés N1, N2 ou N3
selon la **structure** de l'exercice (leurres, distracteurs défendables, raisonnement en plusieurs sauts) — pas
selon le sujet ; chaque fichier `src/data/game-*.ts` écrit en tête ce que valent ses trois niveaux.

- `src/lib/series.ts` compose les séries (`defineSeries`) : par niveau (`mix`), par thème (`filter`) ou par liste
  explicite (`ids`, une série = un scénario pour les crises, les pages CSP, les design docs…). La composition
  est déterministe ; seule une « Mêlée » (`shuffleEachTime`) est retirée à chaque partie.
- `src/components/Series.tsx` affiche le choix et l'écran de fin. Le record d'une série est stocké sous la clé
  `jeu:série`, sans XP : l'XP reste accordée sur le record du jeu.
- `npm run games` exige au moins cinq séries par jeu, aucune vide ni en double, et refuse un jeu qui ne passe
  pas par l'écran de séries.
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
sur M7, M9, M8, M15 et M27.

```bash
cd lab && npm install && npm run dev   # http://127.0.0.1:5199
```

Les challenges jouables sont dans [`lab/CHALLENGES.md`](lab/CHALLENGES.md) et ceux qui sont spécifiés dans
[`lab/ROADMAP.md`](lab/ROADMAP.md), chacun relié aux leçons qui le traitent ; les décomptes à jour sont en tête de
CHALLENGES.md, qui est généré. Un exercice se valide quand le serveur constate lui-même la violation d'invariant. Vient ensuite le vrai
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

## Comptes et progression

XP, niveaux, badges, scores et répétition espacée sont enregistrés **sur le serveur**, dans le compte de l'étudiant : on retrouve sa progression sur n'importe quel appareil. Un compte est obligatoire. La page Profil permet d'exporter et de restaurer la progression en JSON, de télécharger toutes ses données (RGPD) et de supprimer son compte.

**La progression reste un document JSON** (une ligne par utilisateur). Ajouter un jeu, un module ou une leçon ne demande donc **aucune migration** : ce sont de nouvelles clés dans `scores` ou `lessons`. Un changement de *forme* passe par `version` et `sanitize()` dans `src/store/progress.tsx`.

Le navigateur enregistre environ une seconde après chaque action. Deux onglets ou deux appareils qui écrivent en même temps ne s'écrasent pas : le serveur refuse l'écriture périmée (409) et le navigateur fusionne (`src/store/merge.ts`) sans rien perdre.

### Enseignants

**Premier démarrage.** Si la base ne contient aucun enseignant, le serveur crée le compte `teacher` (l'identifiant n'a pas la forme d'un email, l'inscription ne peut donc pas le prendre) avec un mot de passe aléatoire. Il est écrit dans `teacher-initial-password.txt`, à côté de la base, en lecture pour son seul propriétaire, et jamais dans les journaux. Lis-le, change-le dans ton profil, puis supprime le fichier. Si un enseignant existe déjà (déploiement existant), rien n'est créé.

Un compte est **étudiant** à l'inscription. On devient enseignant uniquement en ligne de commande (aucune route de l'API ne change un rôle) :

```bash
npm run user -- set-role prof@ecole.fr teacher
```

Un enseignant crée des promos (`/enseignant`), donne leur code à 8 caractères, puis suit chaque étudiant : leçons, modules, diagnostics avant/après, jeux, examens, dernière activité, export CSV. L'étudiant saisit le code à l'inscription ou depuis son profil, et sait que son enseignant verra son nom, son email et sa progression. Un enseignant ne voit **que** les étudiants inscrits à **ses** promos.

Il n'y a pas d'envoi d'email : un mot de passe oublié se règle par un lien à usage unique (24 h) que l'enseignant génère depuis la fiche de l'étudiant, ou `npm run user -- reset-link <email>`.

```bash
npm run user -- list-users                       # les comptes
npm run user -- set-role <email> <student|teacher>
npm run user -- reset-link <email>
npm run user -- backup <fichier>                 # sauvegarde à chaud
```

## Héberger

Le serveur écoute sur `HOST:PORT`, sert `dist/` et l'API `/api`. Il garde ses données dans **un fichier SQLite** : il lui faut un disque qui persiste, et **une seule instance** (les limites de tentatives sont en mémoire).

| Variable | Rôle | Défaut |
|---|---|---|
| `NODE_ENV=production` | cookie `Secure` préfixé `__Host-`, origine https obligatoire | développement |
| `PUBLIC_ORIGIN` | origine publique, **obligatoire en production** (`https://academy.example.org`). Liste séparée par des virgules. Les requêtes qui modifient l'état venant d'une autre origine sont refusées. | dev : `localhost` |
| `DATABASE_PATH` | fichier SQLite, **obligatoire en production** (`/data/appsec.db`) | `data/appsec.db` |
| `TRUST_PROXY` | nombre de reverse proxys devant le serveur (`1` derrière Caddy ou nginx) | `0` |
| `HOST` / `PORT` | adresse et port d'écoute | `127.0.0.1` / `4300` |
| `DIST_DIR` | dossier du front compilé | `dist/` |

**`TRUST_PROXY` compte.** Derrière un reverse proxy, sans `TRUST_PROXY=1`, toutes les requêtes semblent venir de la même IP et les limites de tentatives deviennent communes à tous. À l'inverse, `TRUST_PROXY=1` sans proxy laisse n'importe qui choisir son IP avec `X-Forwarded-For`. Le serveur prévient au démarrage.

### Sur un VPS, avec Docker

La base vit dans le volume nommé `appsec-data`, jamais dans l'image : un redéploiement remplace le
conteneur sans toucher aux comptes ni à la progression. Le conteneur écoute toujours sur `4300` à
l'intérieur ; c'est la publication qui choisit le port de l'hôte.

```bash
git clone <remote> appsec && cd appsec
cp .env.example .env     # il n'arrive PAS avec le clone (ignoré par git) : à recréer sur chaque serveur
```

#### Lancer (mode HTTP, déploiement actuel)

```bash
docker compose -f docker-compose.yml -f docker-compose.http.yml up -d --build
docker compose logs -f app                  # vérifier le démarrage, puis Ctrl-C
```

Avec le `.env.example` livré, le site répond sur <http://185.222.145.82:44017>.

Au premier démarrage, un compte enseignant `teacher` est créé, mot de passe dans le volume :

```bash
docker compose exec app cat /data/teacher-initial-password.txt
# se connecter, changer le mot de passe dans le profil, puis :
docker compose exec app rm /data/teacher-initial-password.txt
```

L'override met `NODE_ENV=development`, parce que c'est ce réglage — et lui seul — qui conditionne
l'origine https obligatoire et le préfixe `__Host-` du cookie, que le navigateur ignore hors HTTPS :
en production sur http, le site s'afficherait mais personne ne pourrait se connecter. Le contrôle
d'origine, les limites de tentatives et argon2id restent en place.

**Ce mode expose les sessions et les mots de passe en clair sur le réseau**, et un port publié sur
`0.0.0.0` traverse `ufw` (Docker insère ses règles iptables en amont) : il est réellement public.
Bon pour une mise en route ou une démonstration, pas pour de vrais comptes étudiants.

#### Lancer en HTTPS, plus tard

Dès qu'un domaine pointe sur le VPS, décommente le bloc HTTPS de `.env` (`PUBLIC_ORIGIN` en https,
`BIND_ADDR=127.0.0.1`, `TRUST_PROXY=1`) et relance sans l'override :

```bash
docker compose --profile proxy up -d --build
docker compose logs caddy | grep -i certificate   # confirmer l'obtention du certificat
```

Le profil `proxy` ajoute **Caddy**, qui prend le certificat Let's Encrypt pour le domaine de
`PUBLIC_ORIGIN`, le renouvelle seul et redirige `http://` vers `https://`. Il lui faut le DNS déjà
propagé et les ports **80** (validation ACME) **et 443** (le site) joignables. Si l'hôte a déjà un
nginx ou un Caddy, omets `--profile proxy` : le serveur est alors publié sur `127.0.0.1:4300`, à
proxyfier vers cette adresse.

La base ne change pas en passant d'un mode à l'autre, mais le cookie change de nom : tout le monde
doit se reconnecter une fois.

#### Redéployer, arrêter, inspecter

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.http.yml up -d --build   # mode HTTP
docker compose --profile proxy up -d --build                                    # mode HTTPS

docker compose ps                        # état et ports publiés
docker compose logs -f app               # suivre les journaux
docker compose restart app               # redémarrer sans reconstruire
docker compose down                      # arrêter — les volumes restent
docker compose down -v                   # arrêter ET SUPPRIMER la base
```

Les migrations SQL s'appliquent au démarrage, il n'y a pas de commande à lancer. Les certificats ont
leur propre volume, ce qui évite d'en redemander un à chaque redéploiement (Let's Encrypt limite les
demandes par domaine et par semaine).

#### Administrer

La CLI s'exécute dans le conteneur, contre la base du volume :

```bash
docker compose exec app npm run user -- list-users
docker compose exec app npm run user -- set-role prof@ecole.fr teacher
docker compose exec app npm run user -- reset-link <email>
```

**Sauvegardes.** Une copie du fichier SQLite pendant qu'il est utilisé peut être corrompue ; utilise la
sauvegarde à chaud, à mettre en cron — puis sors la copie du serveur, un volume sur le même disque
n'est pas une sauvegarde :

```bash
0 3 * * * cd /srv/appsec && docker compose exec -T app npm run user -- backup /data/backup-$(date +\%F).db
```

### Ce que le serveur fait, et ses limites

- Mots de passe en **argon2id** (19 Mio, 2 passes), jamais stockés ni journalisés. Sessions : jeton de 256 bits en cookie `HttpOnly`, `SameSite=Lax`, dont seul le sha256 est en base ; expiration après 7 jours d'inactivité ou 30 jours au total ; révocation au changement de mot de passe.
- CSP stricte, sans script ni style en ligne ; le script de thème est un fichier (`public/theme.js`). Aucun CORS.
- Toute route `/api` est protégée par défaut ; les routes publiques sont les quatre de `routes/auth.ts`.
- **L'inscription révèle si un email existe déjà** : sans envoi de mail, on ne peut pas répondre autrement. Les échecs de connexion sont limités par IP uniquement : une limite par email permettrait de verrouiller le compte de quelqu'un d'autre. Le coût d'argon2id freine le bourrage de mots de passe.
- **Les réponses des quiz et examens sont dans le code du site**, par choix : un étudiant motivé peut obtenir le certificat. Il atteste d'un parcours, pas d'une évaluation surveillée. La progression (XP, scores) est aussi déclarée par le navigateur.
- Le lab Novafact (`lab/`) n'est **pas** hébergé : il est volontairement vulnérable et reste sur la machine de chaque étudiant.

## Tests

```bash
npm run test:server      # 200+ tests : fonctionnels et sécurité, sur une base en mémoire (~1 s)
npm run test:security    # uniquement les tests de droits et de sécurité
```

Il n'y a pas de test côté navigateur. Les tests serveur démarrent l'application en process, sans rien d'externe.

- `server/test/functional/` : inscription, connexion, progression (dont le conflit 409), promos, export et suppression de compte, fichiers statiques, configuration, CLI.
- `server/test/security/` : la **matrice des droits** (`authz-matrix.test.ts`) déclare, pour chaque route de l'API, le statut attendu pour chaque type d'acteur, et vérifie qu'un refus ne modifie **rien** en base. Un test de complétude échoue si une route est ajoutée sans ligne dans la matrice. S'y ajoutent l'IDOR, l'élévation de privilèges, les sessions, le CSRF, la limitation des tentatives, la validation des entrées et les en-têtes.

Contenu pédagogique non officiel. OWASP, MITRE ATT&CK®, CSSLP® (ISC2) et Burp Suite (PortSwigger) sont des marques de leurs détenteurs respectifs.
