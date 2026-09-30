// M11 · Threat modeling & MITRE — challenges jouables.
//
// Challenges « artifact » : l'apprenant PRODUIT un fichier dans `workspace/`,
// et c'est ce fichier qui est jugé. Le chemin donné par `file` est relatif à
// `workspace/` — `threats/stride.yaml` signifie `workspace/threats/stride.yaml`.
//
// Les vérifications correspondantes sont dans server/audit/m11.ts.
//
// Ce que ces challenges NE mesurent pas, et que chaque énoncé dit : la
// perspicacité d'un modèle. Le harnais constate la complétude structurelle et
// la cohérence avec le code — jamais « as-tu vu la bonne menace ».

import type { ExerciseDef } from '../exercises.ts';

export const m11: ExerciseDef[] = [
  {
    id: 'dfd-as-code', module: 'm11', title: 'Le DFD qui remonte la bonne menace',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D4'], cwe: 'CWE-1059', k: [2],
    brief:
      'Novafact n’a pas de schéma de flux de données. Chacun a sa version de l’architecture, et aucune ne mentionne le service de métadonnées.',
    goal:
      'Modéliser l’application — acteurs, processus, magasins, flux, frontières de confiance — dans `threats/novafact.dfd.yaml`, et faire remonter par le moteur de règles les menaces attendues. Un flux porte un faisceau de routes (`routes:`) : aucune route montée ne doit rester dehors, et le champ `authenticated` de chaque flux doit correspondre au middleware du code.',
    file: 'threats/novafact.dfd.yaml',
    lessons: ['m11/l01', 'm11/l05'],
    hints: [
      'Le format : `boundaries: [{id}]`, `elements: [{id, type: actor|process|store|external, boundary, …}]`, `flows: [{id, from, to, authenticated, routes: []}]`. Les routes s’écrivent « GET /api/invoices/:id ».',
      'Le harnais recalcule lui-même les menaces à partir de ton modèle : fabriquer une liste de menaces à la main n’apporte rien. Ce sont les attributs des éléments qui les déclenchent — `encrypted`, `tenant_scoped`, `client_controlled_url`, `metadata_service`.',
      'La menace que personne n’avait vue demande deux choses : un élément `external` avec `metadata_service: true`, et un flux qui part du processus qui joint une URL fournie par le client. Ce processus doit vraiment servir une route dont le code fait un `fetch`.',
    ],
    fix:
      'Le harnais impose un modèle minimal, vérifie qu’aucune route montée n’est absente du schéma, que l’authentification déclarée est celle du code, puis rejoue son moteur de règles : le flux non authentifié vers les métadonnées doit produire sa menace. Ce qui n’est pas noté : la pertinence des menaces que tu as choisi de décrire. Passer ce test ne veut pas dire « bon modèle » — ça veut dire « rien d’incohérent détecté ».',
  },
  {
    id: 'stride-per-element', module: 'm11', title: 'STRIDE par élément, sans trou',
    status: 'live', kind: 'artifact', level: 1, csslp: ['D4'], cwe: 'CWE-1059', k: [2],
    brief:
      'L’atelier de threat modeling a produit onze menaces, toutes sur l’API, aucune sur le stockage ni sur les flux.',
    goal:
      'Dans `threats/stride.yaml`, énumérer pour chaque élément du schéma de référence (fixtures/m11/stride-elements.json) les catégories STRIDE applicables, la mitigation, et le fichier qui l’implémente.',
    file: 'threats/stride.yaml',
    lessons: ['m11/l02', 'm08/l01'],
    hints: [
      'Le format : `elements: [{id, type, file?, route?, threats: [{category, threat, mitigation, control}]}]`. Les catégories s’écrivent S, T, R, I, D, E.',
      'La règle STRIDE-par-élément n’est pas au choix : une entité externe porte deux catégories, un flux trois — pas d’élévation de privilège sur un flux —, un magasin quatre, un processus les six.',
      'Chaque processus doit désigner le fichier de routeur qu’il représente (`file:`) et une route réellement montée depuis ce fichier (`route:`) ; chaque `control:` doit être un chemin de fichier qui existe dans le dépôt.',
    ],
    fix:
      'La complétude est mécanique, et c’est exactement ce que STRIDE apporte à un atelier : zéro trou, zéro catégorie hors-sujet. Ce qui n’est pas noté : la qualité des menaces décrites. Le harnais refuse en revanche une analyse recopiée — si la même phrase revient d’un élément à l’autre, il le dit.',
  },
  {
    id: 'attack-tree', module: 'm11', title: 'L’arbre d’attaque coupé',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D4'], cwe: 'CWE-1059',
    brief:
      'On sait qu’un locataire ne doit pas lire les factures d’un autre. On ne sait pas par combien de chemins il le pourrait.',
    goal:
      'Construire dans `threats/tenant-breach.deciduous.yaml` l’arbre qui mène au vol d’une facture d’un autre tenant, et montrer que chaque chemin est coupé par une mitigation réellement implémentée.',
    file: 'threats/tenant-breach.deciduous.yaml',
    lessons: ['m11/l03', 'm08/l05'],
    hints: [
      'Le format, dans l’esprit de Deciduous : `facts: [{id, label}]`, `attacks: [{id, label, from: [], challenge?}]`, `goals: [{id, label, from: []}]`, `mitigations: [{id, mitigates: [], implemented_by, evidence}]`.',
      'Une mitigation ne compte que si elle est faite : `implemented_by` doit désigner un fichier du corrigé (`solutions/…`) et `evidence` un fragment de code qu’on y retrouve vraiment.',
      'Au moins trois attaques doivent être rattachées à un challenge jouable (`challenge:`), et la mitigation qui coupe une de ces attaques doit corriger le fichier que ce challenge porte.',
    ],
    fix:
      'Le harnais fait de la théorie des graphes : le graphe est acyclique, chaque objectif est atteignable depuis un fait, et tout chemin d’un fait vers un objectif traverse au moins une mitigation implémentée. Une mitigation déclarée mais pas faite laisse le chemin ouvert, et le test nomme le chemin qui reste. Ce qui n’est pas noté : le choix des attaques que tu as mises dans l’arbre.',
  },
  {
    id: 'cwe-capec-attack', module: 'm11', title: 'Du CWE à la technique ATT&CK',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D4'], cwe: 'CWE-1059',
    brief:
      'Les développeurs parlent CWE, les équipes de détection parlent ATT&CK, et personne ne fait le lien.',
    goal:
      'Remonter, pour cinq challenges jouables du lab, du défaut au motif d’attaque puis à la technique ATT&CK, dans un CSV `threats/attack-chain.csv` aux colonnes challenge, cwe, capec, attack, attack_name.',
    file: 'threats/attack-chain.csv',
    lessons: ['m11/l04', 'm18/l04'],
    hints: [
      'Le CWE d’un challenge n’est pas à deviner : il est dans le registre du lab, sur la page du challenge.',
      'Les correspondances sont embarquées dans fixtures/m11/mitre.json — CWE → CAPEC par les « Related Weaknesses », CAPEC → ATT&CK par les « Taxonomy Mappings ».',
      'Cinq challenges distincts, venant d’au moins trois modules différents. Le nom de la technique doit être celui de la technique, au caractère près.',
    ],
    fix:
      'Aucune interprétation : ce sont des jointures, et le harnais vérifie chaque maillon. L’intérêt est ailleurs — c’est cette chaîne qui permet de dire à une équipe de détection ce qu’elle doit voir passer quand ce défaut-là est exploité.',
  },
  {
    id: 'linddun-privacy', module: 'm11', title: 'LINDDUN sur le parcours de facturation',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D3', 'D4'], cwe: 'CWE-1059',
    brief:
      'Le threat model couvre la sécurité. Les menaces sur la vie privée — traçabilité, détectabilité, non-conformité — n’ont jamais été regardées.',
    goal:
      'Dans `threats/linddun.yaml`, analyser chaque flux du parcours de facturation qui transporte une donnée personnelle, et proposer la mesure pour chacun.',
    file: 'threats/linddun.yaml',
    lessons: ['m11/l03', 'm07/l06'],
    hints: [
      'Le format : `flows: [{route, personal_data: [], categories: [], measure, control}]`. Les sept catégories s’écrivent L, I, NR, D, DD, U, NC.',
      'Le périmètre se déduit du code : une route en fait partie si son gestionnaire touche une collection du parcours (fixtures/m11/data-classification.json dit lesquelles, et quelles données personnelles chacune porte).',
      'Les données personnelles d’une route sont celles de TOUTES les collections que son gestionnaire manipule — pas seulement celles du parcours.',
    ],
    fix:
      'Le harnais croise avec la classification : tout flux qui transporte un champ personnel doit être analysé, les catégories doivent appartenir aux sept, et la mesure citée doit pointer un fichier existant. La couverture est décidable ; la pertinence de la mesure ne l’est pas et n’est pas notée. Une même mesure recopiée sur plusieurs flux est en revanche rejetée.',
  },
  {
    id: 'tm-drift-ci', module: 'm11', title: 'Le modèle qui bloque la PR',
    status: 'live', kind: 'artifact', level: 2, csslp: ['D2', 'D4'], cwe: 'CWE-1059', k: [2],
    brief:
      'Le modèle de menaces a été fait une fois, il y a huit mois. Quinze routes ont été ajoutées depuis.',
    goal:
      'Écrire `scripts/tm-drift.mjs`, appelé « node tm-drift.mjs <dossier-server> <modele.json> » : sortie 0 si toute route montée sous ce dossier figure dans le modèle, sortie non nulle sinon, en nommant les routes manquantes.',
    file: 'scripts/tm-drift.mjs',
    lessons: ['m11/l05', 'm01/l05'],
    hints: [
      'Le modèle est un JSON `{ "routes": ["GET /api/invoices", …] }`. Le dossier passé en argument contient `index.ts` et `routes/`.',
      'Il faut retrouver les préfixes de montage (`app.use(\'/api/x\', xRoutes)`) puis les routes de chaque routeur, et recomposer « MÉTHODE /chemin/complet ».',
      'Le harnais ajoute une route dont le nom change à chaque audit : impossible de la coder en dur. Il vérifie aussi qu’un modèle amputé d’une route fait échouer le script — sinon il ne compare rien.',
    ],
    fix:
      'Le harnais exécute ton script trois fois : sur un arbre conforme (il doit passer), sur un arbre où une route a été ajoutée (il doit bloquer et nommer la route), et sur un modèle incomplet (il doit bloquer). Binaire. C’est ce qui transforme le threat modeling d’un atelier annuel en une vérification continue.',
  },
  {
    id: 'tm-ai-supply-dev', module: 'm11', title: 'Modéliser l’agent, la chaîne et le poste',
    status: 'live', kind: 'artifact', level: 3, csslp: ['D4', 'D8'], cwe: 'CWE-1059', k: [13],
    brief:
      'Trois surfaces n’ont jamais été modélisées : l’assistant et ses outils, la chaîne de construction, et l’environnement de développement lui-même.',
    goal:
      'Produire `threats/agent.yaml`, `threats/supply-chain.yaml` et `threats/workstation.yaml`, avec pour chacun les frontières de confiance et les menaces que les deux autres ne couvrent pas.',
    file: 'threats/',
    lessons: ['m11/l06', 'm19/l05'],
    hints: [
      'Chaque fichier porte `threats: [{threat, boundary, control}]` et une clé d’inventaire qui lui est propre : `tools:` pour l’agent, `pipeline:` pour la chaîne, `secrets:` pour le poste.',
      'Les trois inventaires se lisent dans le dépôt : les outils dans le code de l’assistant, les étapes sous la forme « fichier.yml:job » dans les workflows de `novafact/`, les secrets dans ces mêmes workflows et dans `.npmrc`.',
      'Une menace recopiée d’un modèle à l’autre fait échouer la vérification : c’est le sens de l’exercice — chaque surface porte ce que les autres ne voient pas.',
    ],
    fix:
      'Le harnais vérifie la couverture structurelle et la cohérence avec le dépôt : chaque outil de l’agent est modélisé, chaque job du pipeline apparaît, chaque secret joignable depuis un poste est listé, et rien d’inventé. Kohnfelder insiste sur le troisième : le code source est l’actif principal, et le poste du développeur y accède. Ce qui n’est pas noté : la qualité des menaces décrites.',
  },
];
