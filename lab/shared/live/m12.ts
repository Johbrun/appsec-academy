// m12 · Revue de code sécurité — challenges jouables.
//
// Challenges « artifact » : l'apprenant produit un fichier dans `workspace/`.
// `review/pr-42.yaml` signifie `workspace/review/pr-42.yaml`.
//
// Les vérifications correspondantes sont dans server/audit/m12.ts. Le
// challenge `variant-hunt` de la spécification est de type « fix » : il vit
// dans le code du lab, pas ici.

import type { ExerciseDef } from '../exercises.ts';

export const m12: ExerciseDef[] = [
  {
    id: 'attack-surface-map', module: 'm12', title: 'La carte des sources et des sinks',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D5', 'D6'], cwe: 'CWE-1059',
    brief:
      'Personne n’a de vue d’ensemble de Novafact : ni la liste des routes réellement montées, ni celle des sinks dangereux.',
    goal:
      'Cartographier la base dans `review/attack-surface.yaml` comme on le ferait sur un dépôt inconnu : `entrypoints` (route et authentification) et `sinks` (fichier, ligne, famille).',
    file: 'review/attack-surface.yaml',
    lessons: ['m12/l02', 'm12/l01'],
    hints: [
      'Le format : `entrypoints: [{route: "GET /api/invoices/:id", auth: required|none|admin}]` et `sinks: [{file, line, kind}]`.',
      'Commence par `server/index.ts` : il dit quels routeurs sont montés et sous quel préfixe. L’authentification vient du middleware, pas de l’intention.',
      'Les familles de sinks sont : requete-donnees, fusion-objet, chemin, fichier, requete-sortante, regex, mail, html, script-tiers. Les routes de plomberie du lab (`/api/lab/*`) sont hors sujet et ne comptent ni en plus ni en moins.',
    ],
    fix:
      'Le harnais extrait la vérité terrain par analyse du code et mesure les deux erreurs : ce qui a été manqué et ce qui a été inventé. Les seuils sont 90 % des routes, 80 % des sinks, au plus une entrée inventée de chaque côté — tout lister n’est donc pas une stratégie gagnante. C’est l’exercice de méthode le plus automatisable du métier, et celui par lequel commence tout audit.',
  },
  {
    id: 'secbench-sink', module: 'm12', title: 'Trouver le sink d’une vraie CVE',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D5', 'D6'], cwe: 'CWE-1059',
    brief:
      'On te donne trois paquets npm vulnérables (fixtures/m12/packages/) et leurs avis de sécurité (fixtures/m12/advisories.json). Pas le correctif.',
    goal:
      'Localiser le sink de chacun — fichier, ligne, colonne — et nommer la classe de vulnérabilité, dans `review/cve-sink.yaml`.',
    file: 'review/cve-sink.yaml',
    lessons: ['m12/l04', 'm12/l02'],
    hints: [
      'Le format : `findings: [{advisory, package, file, line, column, class}]`. Le fichier est relatif au paquet, par exemple `lib/merge.js`.',
      'Chaque paquet embarque un `exploit.mjs` : il prouve que la vulnérabilité est là, il ne dit pas où. Lance-le, puis remonte de l’effet vers la ligne.',
      'Les cinq classes du lab : prototype-pollution, path-traversal, command-injection, code-injection, redos. La colonne est celle où commence l’opération dangereuse, à quatre caractères près.',
    ],
    fix:
      'L’emplacement du sink est recalculé dans les sources à chaque audit : déplacer une ligne déplace la bonne réponse, aucune liste n’est stockée. Et l’exploit sert d’oracle. C’est la méthode de lecture d’un correctif de CVE, jouée à l’envers : on part de l’effet décrit par l’avis et on remonte à l’opération.',
  },
  {
    id: 'review-pr-verdicts', module: 'm12', title: 'La revue de PR notée sur ses verdicts',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D5', 'D6'], cwe: 'CWE-1059',
    brief:
      'Une pull request touche l’autorisation (fixtures/m12/pr-42.diff). Elle contient de vrais défauts bloquants, et plusieurs leurres plausibles.',
    goal:
      'Rendre un verdict par constat dans `review/pr-42.yaml` : bloquant, a-corriger, suggestion, ou acceptable.',
    file: 'review/pr-42.yaml',
    lessons: ['m12/l03', 'm12/l05'],
    hints: [
      'Le format : `findings: [{file, line, verdict, cwe, raison}]`. La ligne est celle du fichier d’arrivée, telle que le diff la numérote.',
      'Trois questions suffisent sur une PR d’autorisation : qui est l’appelant, d’où vient cette identité, et que se passe-t-il quand le contrôle dit non.',
      'Tout marquer bloquant échoue : un générateur non cryptographique dans un identifiant d’affichage, une trace, un commentaire de suivi ou une comparaison lâche ne sont pas des bloquants. Chaque bloquant demande son CWE et un motif écrit.',
    ],
    fix:
      'La PR est fabriquée pour ça : le harnais sait quelles lignes portent le défaut et lesquelles sont des leurres. Un bloquant manqué échoue, un leurre marqué bloquant échoue aussi — parce que bloquer à tort coûte la confiance de l’équipe, et qu’on ne la récupère pas. C’est la seule façon honnête d’automatiser une revue : la qualité du commentaire, elle, relève de la persuasion et n’est pas notée.',
  },
  {
    id: 'review-ai-pr', module: 'm12', title: 'Revoir une PR écrite par une IA',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D5', 'D6'], cwe: 'CWE-1078',
    brief:
      'Une pull request générée par un agent (fixtures/m12/ai-pr.diff) ajoute une fonctionnalité plausible : validation absente, dépendance inventée, secret en dur, crypto approximative.',
    goal:
      'Rendre la revue dans `review/ai-pr.yaml`, et refuser la PR pour les bonnes raisons.',
    file: 'review/ai-pr.yaml',
    lessons: ['m12/l06', 'm12/l03'],
    hints: [
      'Le format : `verdict: rejetee` et `findings: [{type, package?, file?, line?, raison}]`. Les types notés sont `dependance-inexistante` et `secret-en-dur`.',
      'La PR ajoute deux dépendances. Une seule existe : fixtures/m12/npm-snapshot.json est l’instantané du registre. Signaler la vraie comme inventée est un faux positif, et il fait échouer.',
      'Le secret se donne par son fichier et sa ligne, dans la numérotation du fichier d’arrivée.',
    ],
    fix:
      'Deux constats sur quatre sont mécaniquement décidables et c’est sur eux qu’on note : le paquet ajouté n’existe pas dans l’instantané, et le secret est détecté par motif — aucun des deux n’est stocké comme réponse, les deux sont recalculés depuis le diff. Les deux autres sont vérifiés par le test de régression après correction. Le volume change, la méthode non : vérifier l’existence de chaque dépendance ajoutée devient un réflexe.',
  },
  {
    id: 'timeboxed-audit', module: 'm12', title: 'Quatre heures, et on rend',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D5', 'D6'], cwe: 'CWE-1059',
    brief:
      'Un dépôt qu’on ne connaît pas, une journée, et une question : qu’est-ce qui peut faire perdre de l’argent à ce client ?',
    goal:
      'Rendre dans `review/audit-report.yaml` les trois constats de plus fort impact, avec leur chemin d’exploitation.',
    file: 'review/audit-report.yaml',
    lessons: ['m12/l07', 'm12/l01'],
    hints: [
      'Le format : `findings: [{challenge, file, impact, chain: []}]`, exactement trois. Le `chain` est une suite de routes réellement montées, de l’entrée jusqu’à l’endroit où l’invariant se rompt.',
      'La question n’est pas « quelle est la faille la plus technique » mais « qu’est-ce qui coûte de l’argent ». Regarde ce que le code appelle un invariant métier.',
      'Au moins deux des trois doivent faire perdre de l’argent directement, pas plus tard. La dernière étape du chemin doit être la route où le défaut se manifeste vraiment.',
    ],
    fix:
      'Le harnais connaît le classement de référence par impact et note le résultat — pas la stratégie, qui n’est pas observable et n’est donc pas notée. Aller de la surface exposée vers les actifs de valeur, comme en revue de conception, reste la méthode qui rend le mieux sur un temps court.',
  },
];
