// M1 · Programme AppSec & DevSecOps — challenges jouables.
//
// Challenges « artifact » : il n'y a rien à exploiter et rien à corriger dans
// le dépôt. L'apprenant PRODUIT un fichier dans `workspace/`, et c'est ce
// fichier que le harnais juge — en le confrontant au code, en refaisant ses
// calculs, ou en l'exécutant contre des jeux qu'il fabrique.
//
// Les données de départ sont embarquées dans `fixtures/m01/` : rapport de
// pentest, modèle de maturité, étude descriptive, analyse de composition,
// catalogue d'exploitation connue, référentiel de développement sécurisé.
//
// Les vérifications correspondantes sont dans server/audit/m01.ts.
//
// Deux leçons du module restent hors du lab, et c'est assumé : le choix des
// métriques (m01/l06) et la crédibilité d'une feuille de route devant une
// direction relèvent du jugement d'expert. Un harnais ne les départage pas.

import type { ExerciseDef } from '../exercises.ts';

export const m01: ExerciseDef[] = [
  {
    id: 'pentest-to-appsec', module: 'm01', title: 'Du finding au backlog',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D2', 'D6'], cwe: 'CWE-1059',
    brief: 'Le lab contient un rapport de pentest classique : `fixtures/m01/pentest-report.json`, treize constats triés par sévérité, sans classe de bugs, sans propriétaire et sans échéance.',
    goal: 'Le transformer en backlog d’équipe : regrouper les constats par classe de bugs, et donner pour chaque classe le CWE, le fichier fautif, le correctif structurel, le test de régression qui l’établit, l’équipe propriétaire et l’échéance.',
    file: 'program/backlog.yaml',
    lessons: ['m01/l01', 'm06/l02'],
    hints: [
      'Deux constats qui portent le même défaut au même endroit ne font pas deux tickets. Commence par lire les treize constats et par chercher, dans le code du lab, la ligne qui les explique.',
      'Chaque classe porte le nom de l’exercice correspondant du lab (`bola-invoice`, `nosql-auth`…) : le registre donne alors son CWE et le fichier qui la porte, et `verify/security.test.ts` contient déjà la suite de tests qui la couvre. Les équipes existent dans `fixtures/m01/organisation.yaml`.',
      'Structure attendue : `classes:` — une entrée par classe, avec `classe`, `cwe`, `fichier`, `constats: [PT-…]`, `correctif-structurel` (au moins 60 caractères, propre à la classe), `test`, `equipe` et `echeance` (AAAA-MM-JJ). Chaque constat du rapport apparaît une fois et une seule, et une classe plus grave ne peut pas être promise plus tard qu’une classe moins grave.',
    ],
    fix: 'Passer de « voici 13 bugs » à « voici 9 classes et les contrôles qui les éliminent » est tout le métier. Le harnais vérifie que chaque constat du rapport est repris une fois, que sa classe correspond au CWE du registre, que le fichier cité est bien celui qui porte le défaut, et que le test cité existe et couvre la classe. La qualité rédactionnelle du correctif n’est pas notée — seulement qu’il existe et qu’il n’a pas été recopié d’une autre classe.',
  },
  {
    id: 'paved-road-template', module: 'm01', title: 'Le gabarit de route qui naît sûr',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2', 'D5'], cwe: 'CWE-1188',
    brief: 'Chaque nouvelle route de Novafact réimplémente à sa façon l’authentification, la validation et le filtrage par tenant. Trois d’entre elles s’y sont trompées.',
    goal: 'Écrire le squelette de route que toute nouvelle route reprendra, et prouver qu’il est sûr par défaut : le harnais s’en sert pour générer une ressource qu’il est seul à connaître, puis l’attaque.',
    file: 'templates/route.ts',
    lessons: ['m01/l02', 'm06/l07'],
    hints: [
      'On ne mesure pas ce que le gabarit contient, on mesure ce qu’il refuse. Cinq attaques génériques : appel sans jeton, jeton d’un autre tenant, corps hors schéma, `tenantId`/`role` glissés dans le corps, clé `__proto__`. Et un appel légitime, qui doit continuer à répondre.',
      'Le gabarit exporte `createResourceRouter({ nom, champs, magasin })` et renvoie un `Router` d’Express. `champs` est une table `nom → "string" | "number" | "boolean"` : c’est la liste blanche des champs acceptés à l’écriture. `magasin` est un tableau d’enregistrements qui portent chacun `id` et `tenantId`. Le harnais monte le routeur derrière un middleware qui renseigne `req.user = { tenantId, role, email }` quand un jeton est présent, et rien sinon.',
      'Trois routes à fournir : `GET /` (les enregistrements du tenant de l’appelant), `POST /` (création à partir des seuls champs déclarés, `tenantId` imposé depuis `req.user`, jamais lu dans le corps) et `GET /:id` (4xx si l’enregistrement appartient à un autre tenant). Sans `req.user`, réponds 401. Construis l’objet créé champ par champ depuis `champs` — un `Object.assign` du corps rouvre les trois dernières attaques d’un coup.',
    ],
    fix: 'Le harnais génère une route neuve depuis le gabarit et lui applique une batterie d’attaques génériques : les cinq doivent être refusées et l’appel légitime répondre. On mesure que le chemin par défaut est sûr — c’est la définition du paved road. Un gabarit qui refuse tout échoue au sixième cas, et c’est voulu : une route que personne ne peut utiliser ne sera pas reprise.',
  },
  {
    id: 'samm-assessment', module: 'm01', title: 'Évaluation SAMM qui se calcule',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2'], cwe: 'CWE-1059',
    brief: 'Novafact n’a jamais été évaluée. Les avis divergent sur la maturité réelle du programme, faute de grille commune. Le modèle est embarqué : `fixtures/m01/samm-model.yaml`, 5 fonctions, 15 pratiques, 30 flux, 90 activités.',
    goal: 'Remplir l’évaluation de l’équipe — une réponse par activité — et produire les scores par flux, par pratique, par fonction et le score global, cohérents avec les réponses.',
    file: 'program/samm-assessment.yaml',
    lessons: ['m01/l03', 'm01/l06'],
    hints: [
      'L’en-tête du modèle donne les règles de calcul en huit lignes. Une réponse vaut `non` (0), `partiel` (0,5) ou `oui` (1) ; le score d’un flux est la somme de ses trois réponses.',
      'La contrainte qui piège : un niveau ne peut pas être mieux tenu que celui d’en dessous. Répondre `oui` au niveau 3 d’un flux dont le niveau 1 est `non` est refusé — une maturité ne se saute pas.',
      'Structure attendue : `evaluation:` — une entrée par flux, avec `flux`, `reponses` (table activité → réponse, les trois activités du flux) et `score` ; puis `pratiques:` et `fonctions:` (tables identifiant → score) et `score-global`. Moyennes à chaque étage, arrondies à deux décimales.',
    ],
    fix: 'Le harnais recalcule tous les scores depuis les seules réponses et vérifie la complétude : chaque identifiant d’activité existe dans le modèle, aucun flux n’est laissé vide, aucune évaluation n’est incohérente. Ce qui est jugé, c’est l’arithmétique et la complétude — pas la sincérité des réponses, qui n’est pas vérifiable et qu’il faut assumer comme telle. C’est aussi pour cela qu’une auto-évaluation se contre-expertise.',
  },
  {
    id: 'samm-roadmap', module: 'm01', title: 'La feuille de route dérivée de l’écart',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2'], cwe: 'CWE-1059',
    brief: 'L’évaluation est faite. Reste à en tirer un plan à douze mois qui ne soit ni une liste de vœux ni un copier-coller du modèle.',
    goal: 'Produire la feuille de route qui fait progresser d’un niveau chaque flux des pratiques sous le seuil de 1,5 — tous, et aucun autre.',
    file: 'program/roadmap.yaml',
    lessons: ['m01/l03', 'm01/l08'],
    hints: [
      'La feuille de route se dérive de ton évaluation, pas du modèle : commence par relire les scores de pratique que tu as produits et par retenir ceux qui sont sous 1,5.',
      'Pour chaque flux d’une pratique retenue, le niveau atteint est le plus haut palier entièrement tenu (`oui`). L’activité à programmer est celle du niveau immédiatement supérieur — pas la plus spectaculaire, la suivante.',
      'Structure attendue : `seuil: 1.5` et `jalons:` — une entrée par flux à faire progresser, avec `pratique`, `flux`, `niveau-actuel`, `activite` (l’identifiant du modèle) et `echeance` (T1 à T4). Un flux déjà au niveau 3 ne prend pas de jalon, même si sa pratique est sous le seuil.',
    ],
    fix: 'Le harnais calcule l’ensemble des pratiques sous le seuil depuis ton évaluation et exige que la feuille de route les couvre exactement, par les activités du niveau immédiatement supérieur. La cohérence avec l’évaluation est objective ; la pertinence pour le métier, l’ordre des trimestres et la faisabilité ne le sont pas et ne sont pas notés.',
  },
  {
    id: 'break-build-gate', module: 'm01', title: 'La porte qui casse le build',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2', 'D6'], cwe: 'CWE-1059',
    brief: 'Aucune porte de contrôle : la CI passe au vert quel que soit le résultat des scanners.',
    goal: 'Écrire la porte qui bloque sur un seuil de sévérité — et seulement là. Le harnais l’exécute contre quatorze rapports d’analyse, dont douze fabriqués à la volée.',
    file: 'scripts/gate.mjs',
    lessons: ['m01/l05', 'm13/l11'],
    hints: [
      'Une porte se juge sur ses deux moitiés. Bloquer toujours est aussi inutile que ne jamais bloquer : dans les deux cas, personne ne regarde plus le résultat.',
      'La politique à implémenter : bloquer si au moins une vulnérabilité de sévérité `HIGH` ou `CRITICAL` dispose d’une version corrigée (`fixed` non nul). Ce qu’on ne peut pas corriger aujourd’hui ne bloque pas le build — ça passe par une exception datée, c’est le challenge suivant.',
      'Contrat : `node workspace/scripts/gate.mjs <rapport.json>`. Code de sortie 0 = la porte laisse passer, différent de 0 = elle bloque. Le format du rapport est celui de `fixtures/m01/gate/rapport-bloquant.json` : `results[].packages[].vulnerabilities[]`, avec `severity` et `fixed`. Les noms de fichiers sont tirés au hasard : ne te sers que du contenu.',
    ],
    fix: 'Le harnais exécute la porte sur deux rapports de référence — un à bloquer, un à laisser passer — puis sur douze rapports fabriqués à la volée, moitié-moitié. Une porte qui bloque toujours échoue sur les seconds ; un `|| true` échoue sur les premiers. C’est le même couple refuse/autorise que les tests de régression, et c’est ce qui distingue une porte d’un affichage. Le seuil retenu, lui, est un arbitrage : il est donné par l’énoncé, il n’est pas noté.',
  },
  {
    id: 'risk-exception', module: 'm01', title: 'L’exception qui expire',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2', 'D6'], cwe: 'CWE-1059',
    brief: 'Des vulnérabilités bloquent la CI et ne peuvent pas être corrigées cette semaine — `fixtures/m01/osv-scan.json` dit lesquelles. L’équipe veut « juste désactiver la règle ».',
    goal: 'Déposer les exceptions : motivées, datées, bornées dans le temps, et refusées quand la vulnérabilité est activement exploitée ou quand un correctif existe.',
    file: 'osv-scanner.toml',
    lessons: ['m01/l05', 'm05/l03'],
    hints: [
      'Toutes les vulnérabilités du scan ne s’exceptent pas. Regarde deux colonnes avant d’écrire quoi que ce soit : `fixed`, et la présence de l’identifiant au catalogue d’exploitation connue (`fixtures/m01/kev.json`).',
      'Une vulnérabilité qui a une version corrigée se corrige. Une vulnérabilité activement exploitée ne s’exempte pas, même sans correctif : on retire le composant, on le contourne, on le remplace. Reste exactement ce qui n’a ni correctif ni exploitation connue.',
      'Format : des tables `[[IgnoredVulns]]`, chacune avec `id`, `reason` (au moins 60 caractères, qui nomme la vulnérabilité ou le paquet) et `ignoreUntil` (date AAAA-MM-JJ, dans le futur et à moins de quatre-vingt-dix jours).',
    ],
    fix: 'Le harnais exige pour chaque exception un motif substantiel et propre à elle, une date d’expiration dans le futur et à moins de quatre-vingt-dix jours, et il refuse l’exception dès que l’identifiant figure au catalogue d’exploitation connue ou qu’une version corrigée existe. Il exige aussi la complétude : une vulnérabilité sans correctif laissée sans exception bloque toujours la CI. La pertinence du motif n’est pas jugée — sa présence, sa longueur et son unicité le sont. Une exception sans date n’est pas une exception, c’est un abandon.',
  },
  {
    id: 'ssdf-attestation', module: 'm01', title: 'Attestation SSDF adossée au dépôt',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D2'], cwe: 'CWE-1059',
    brief: 'Un client exige l’attestation de conformité au cadre de développement sécurisé du NIST — non plus comme obligation fédérale, rescindée en janvier 2026, mais comme clause de contrat. Le premier réflexe est de cocher les cases.',
    goal: 'Remplir la matrice des vingt-deux tâches de `fixtures/m01/ssdf-tasks.yaml` en citant, pour chaque tâche revendiquée, la preuve qui existe réellement dans le dépôt.',
    file: 'program/ssdf.yaml',
    lessons: ['m01/l07', 'm01/l08'],
    hints: [
      'Commence par explorer ce que le dépôt contient déjà : `novafact/.github/workflows/`, `novafact/.github/CODEOWNERS`, `verify/`, `novafact/package-lock.json`. Il y a plus de preuves réelles qu’on ne croit, et moins que ce qu’on aimerait cocher.',
      'Quatre statuts : `mis-en-oeuvre`, `partiel`, `non-mis-en-oeuvre`, `non-applicable`. Les deux premiers demandent au moins une preuve — un chemin de fichier qui existe. Le dernier demande une justification. Une tâche que Novafact ne fait pas se déclare telle quelle : c’est ça, attester.',
      'Structure attendue : `taches:` — une entrée par tâche du référentiel, avec `id`, `statut`, et selon le cas `preuves: [chemin, …]` ou `justification`. Trois tâches sont contrôlées plus loin que l’existence du fichier : `PW.7.2`, `PW.8.2` et `RV.1.3` — la clé `approfondies` du référentiel dit ce qui est attendu.',
    ],
    fix: 'Le harnais vérifie que chaque chemin cité existe, et pousse plus loin sur un sous-ensemble : la revue est-elle réellement routée, la suite de tests réellement appelée en CI, l’analyse de dépendances réellement lancée. Une preuve inventée est détectée ; une preuve faible mais réelle passe — et c’est exactement la limite d’une attestation, qui se signe sur l’honneur. Il refuse en revanche les deux raccourcis : plus de trois tâches « non applicable », ou moins de six tâches réellement revendiquées. Ce qui a changé en 2026, c’est qui l’exige, pas ce qu’elle vaut.',
  },
  {
    id: 'cra-notification', module: 'm01', title: 'Le signalement CRA, en test',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D2', 'D8'], cwe: 'CWE-1059',
    brief: 'Le Cyber Resilience Act impose depuis le 11/09/2026 une alerte sous 24 h et une notification sous 72 h pour une vulnérabilité activement exploitée dans un produit.',
    goal: 'Implémenter le déclencheur qui décide si une vulnérabilité du SBOM déclenche l’obligation, et calcule les deux échéances.',
    file: 'scripts/cra-report.mjs',
    lessons: ['m01/l08', 'm05/l06'],
    hints: [
      'La difficulté n’est pas le calcul, c’est de savoir sur quoi porte l’obligation. Elle ne se déclenche pas sur « une vulnérabilité grave » : elle se déclenche sur une vulnérabilité **activement exploitée** qui affecte un composant du produit.',
      'Trois SBOM d’essai dans `fixtures/m01/cra/` donnent les trois décisions : un composant au catalogue, aucun, et deux. Le format est CycloneDX : `vulnerabilities[].affects[].ref` renvoie au `purl` d’un composant de `components[]`.',
      'Contrat : `node workspace/scripts/cra-report.mjs <sbom.json> <catalogue-kev.json> <date-iso>` écrit sur la sortie standard `{"notification": bool, "obligations": [{"composant","version","vulnerabilite","alerteAvant","notificationAvant"}]}` — obligations triées par identifiant de vulnérabilité, échéances à +24 h et +72 h de la date de référence, au format ISO 8601. Le catalogue est passé en argument : ne le code pas en dur, le harnais en fabrique d’autres.',
    ],
    fix: 'Trois SBOM d’essai, trois décisions attendues, puis huit couples SBOM/catalogue tirés au hasard : une fonction pure sur des données passées en argument, donc entièrement déterministe. Le harnais refuse aussi le déclencheur qui rend la même réponse partout. La qualification juridique — ce qui compte comme « produit », ce qui compte comme « connaissance » du fait — n’est pas automatisable et n’est pas jugée ici.',
  },
  {
    id: 'bsimm-compare', module: 'm01', title: 'Se comparer plutôt que se noter',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2'], cwe: 'CWE-1059',
    brief: 'L’évaluation de maturité dit où en est Novafact par rapport au modèle. Elle ne dit pas où en sont les autres. `fixtures/m01/bsimm-observed.yaml` donne, pour trente et une activités, la proportion d’organisations qui les pratiquent réellement.',
    goal: 'Confronter Novafact aux activités réellement observées, calculer l’écart sur celles qui sont très répandues, et nommer les trois qui comptent.',
    file: 'program/bsimm-gap.yaml',
    lessons: ['m01/l04', 'm01/l03'],
    hints: [
      'Un modèle prescriptif dit ce qu’il faudrait faire ; une étude descriptive dit ce qui se fait. La seconde déplace plus de budget que la première — « neuf organisations sur dix le font, nous non » se discute mal.',
      'Le seuil du challenge : une activité est très répandue à partir de 60 %. Ce sont celles-là qu’il faut toutes renseigner. Une activité déclarée faite doit citer une preuve, et la preuve doit exister dans le dépôt.',
      'Structure attendue : `seuil-frequence: 60`, `activites:` (une entrée par activité très répandue, avec `id`, `faite: oui|non` et `preuve` quand c’est oui), `ecart: { nombre, activites: [...] }` et `priorites: [trois identifiants]`. L’écart, c’est exactement les activités très répandues que tu as déclarées non faites.',
    ],
    fix: 'Le harnais vérifie que chaque activité citée existe dans l’étude, que chaque preuve existe dans le dépôt, et que l’écart est calculé à partir de tes propres réponses — pas déclaré. Le choix des trois priorités, lui, n’est pas noté : il dépend du contexte métier, et c’est précisément la conversation qu’on veut avoir. Les deux modèles ensemble évitent autant la complaisance que la course au niveau 3.',
  },
];
