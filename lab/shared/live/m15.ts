// m15 · IAM AWS — challenges jouables.
//
// Challenges « fix » : le défaut vit dans les documents de politique du dépôt
// fixture `novafact/infra/`, pas dans une requête. Aucun compte AWS n'est
// requis — une politique IAM est du JSON, et c'est dans le JSON que le défaut
// est introduit comme corrigé. On l'audite, on corrige le fichier, et on
// relance l'audit — depuis la page du challenge ou par POST /api/lab/audit.
//
// Ce que le lab ne peut pas faire — exécuter l'escalade sur un vrai compte —
// reste chez CloudGoat et IAM Vulnerable.
//
// Les vérifications correspondantes sont dans server/audit/m15.ts.

import type { ExerciseDef } from '../exercises.ts';

export const m15: ExerciseDef[] = [
  {
    id: 'iam-wildcard', module: 'm15', title: 'Politique en joker',
    status: 'live', kind: 'fix', level: 1, csslp: ['D1', 'D7'], cwe: 'CWE-732',
    brief: 'Le rôle de la tâche ECS porte une autorisation totale sur toutes les ressources, « le temps de faire marcher le déploiement ».',
    goal: 'Réécrire la politique au moindre privilège à partir des appels réellement faits par l’application.',
    file: 'novafact/infra/iam/task-role.json',
    lessons: ['m15/l01', 'm15/l05'],
    hints: [
      'Deux champs décident de la portée d’une autorisation : ce qu’on peut faire, et sur quoi.',
      'Une politique se construit à partir des appels que l’application fait vraiment, pas de ceux qu’elle pourrait faire un jour. L’API lit et écrit des factures sur S3, lit deux secrets, déchiffre avec KMS et écrit ses journaux.',
      'Remplace l’instruction en joker par une instruction par usage, chacune nommant sa ressource. Si une ressource doit rester `*`, borne-la par une `Condition`.',
    ],
    fix: 'Partir de l’usage : Access Analyzer génère une politique depuis les appels observés, et les accès inutilisés se lisent dans la console. Puis figer avec des clés de condition et vérifier en CI. Une politique écrite à la main part toujours trop large.',
  },
  {
    id: 'iam-no-users', module: 'm15', title: 'Zéro utilisateur IAM',
    status: 'live', kind: 'fix', level: 1, csslp: ['D1', 'D7'], cwe: 'CWE-522',
    brief: 'Trois utilisateurs IAM portent des clés d’accès permanentes, dont une créée il y a deux ans et jamais tournée.',
    goal: 'Supprimer les identifiants de longue durée au profit de rôles et d’identifiants temporaires, sans couper l’intégration continue.',
    file: 'novafact/infra/iam/users.json',
    lessons: ['m15/l02', 'm15/l05'],
    hints: [
      'Regarde ce que chaque utilisateur porte : une clé d’accès n’expire pas.',
      'Une clé inactive se réactive en un appel, et un mot de passe de console est aussi un identifiant de longue durée.',
      'Vide la liste `Users`, et déclare à la place des rôles dans `Roles` : la CI échange un jeton OIDC (principal `Federated`) contre son rôle, la sauvegarde est assumée par le service, les humains passent par Identity Center.',
    ],
    fix: 'Un identifiant permanent finit dans un dépôt, un journal ou un poste. Identity Center pour les humains, rôles et OIDC pour les machines, et le compte racine verrouillé. Le harnais vérifie qu’aucune clé permanente ne subsiste et que chaque accès passe par une assomption de rôle.',
  },
  {
    id: 'iam-stringequals-wildcard', module: 'm15', title: 'Le joker sous le mauvais opérateur',
    status: 'live', kind: 'fix', level: 1, csslp: ['D1', 'D7'], cwe: 'CWE-183',
    brief: 'Une condition compare une valeur contenant un joker avec un opérateur d’égalité stricte : elle ne correspond jamais, ce qui pousse à l’élargir jusqu’à ce que « ça marche ».',
    goal: 'Corriger l’opérateur et vérifier que la condition filtre réellement ce qu’elle prétend filtrer.',
    file: 'novafact/infra/iam/deploy-role.json',
    lessons: ['m15/l01', 'm15/l04'],
    hints: [
      'Une condition qui ne bloque jamais rien ressemble beaucoup à une condition qui marche.',
      'Tous les opérateurs de condition ne traitent pas `*` de la même façon : certains le comparent caractère par caractère.',
      'Remplace `StringEquals` par `StringLike` là où la valeur contient un joker — ou retire le joker et garde l’égalité. Le harnais relit toutes les politiques de `infra/iam/`.',
    ],
    fix: 'Un joker exige l’opérateur de correspondance de motif ; sous l’opérateur d’égalité il est pris au pied de la lettre. Une condition qui ne correspond jamais est pire qu’absente : elle donne l’impression d’un contrôle, et on la retire au premier incident de production.',
  },
  {
    id: 'iam-passrole', module: 'm15', title: 'Chemin d’escalade par PassRole',
    status: 'live', kind: 'fix', level: 2, csslp: ['D1', 'D7'], cwe: 'CWE-269',
    brief: 'Un rôle de déploiement cumule le droit de passer un rôle et celui de créer une fonction. Deux permissions anodines, un chemin vers l’administration.',
    goal: 'Décrire le chemin d’escalade, puis le couper avec le moins de changements possible.',
    file: 'novafact/infra/iam/deploy-role.json',
    lessons: ['m15/l04', 'm15/l01'],
    hints: [
      'Deux permissions anodines, prises ensemble : lesquelles ?',
      'Passer un rôle, c’est choisir l’identité que prendra le service qu’on crée — et le rôle passé peut être n’importe lequel du compte.',
      'Restreins `iam:PassRole` aux ARN des rôles qu’on a le droit de passer, et ajoute `"Condition": {"StringEquals": {"iam:PassedToService": "lambda.amazonaws.com"}}`. Retirer l’action entièrement convient tout autant.',
    ],
    fix: 'Restreindre le passage de rôle aux ARN précis qu’on a le droit de passer, avec la condition de service destinataire. Les escalades IAM ne viennent presque jamais d’une permission unique : elles viennent de combinaisons que personne n’a regardées ensemble.',
  },
  {
    id: 'iam-create-policy-version', module: 'm15', title: 'Le rôle qui peut se réécrire',
    status: 'live', kind: 'fix', level: 2, csslp: ['D1', 'D7'], cwe: 'CWE-269',
    brief: 'La politique du rôle applicatif autorise la création et l’activation d’une version de politique : il peut se donner tous les droits.',
    goal: 'Retirer les actions auto-référençantes et vérifier qu’aucune ne subsiste dans le périmètre applicatif.',
    file: 'novafact/infra/iam/app-policy.json',
    lessons: ['m15/l04', 'm15/l05'],
    hints: [
      'Resserrer la ressource ne sert à rien ici : c’est l’action elle-même qui pose problème.',
      'Une poignée d’actions IAM permettent à un principal de se réécrire ses propres droits — il en existe une liste connue.',
      'Retire du périmètre applicatif `iam:CreatePolicyVersion`, `iam:SetDefaultPolicyVersion`, `iam:AttachRolePolicy`, `iam:UpdateAssumeRolePolicy` et `iam:CreateAccessKey` — et vérifie aussi `task-role.json`, qu’un joker couvre tout autant.',
    ],
    fix: 'Il existe une liste connue d’actions qui permettent l’escalade — créer une version de politique, attacher une politique, mettre à jour une politique d’approbation, créer une clé d’accès, créer un profil de connexion. Aucune n’a sa place dans un rôle applicatif, et le harnais les refuse toutes.',
  },
  {
    id: 'iam-oidc-trust', module: 'm15', title: 'Trust policy OIDC mal filtrée',
    status: 'live', kind: 'fix', level: 2, csslp: ['D1', 'D7', 'D8'], cwe: 'CWE-1220', k: [4],
    brief: 'Le rôle assumé par la CI fait confiance au fournisseur d’identité sans filtrer le dépôt ni la branche : n’importe quel dépôt GitHub du monde peut le prendre.',
    goal: 'Restreindre au dépôt et à la référence exacts, puis vérifier qu’aucune politique d’approbation ne reste ouverte.',
    file: 'novafact/infra/iam/github-oidc.json',
    lessons: ['m15/l04', 'm14/l02'],
    hints: [
      'Qui peut obtenir un jeton signé par `token.actions.githubusercontent.com` ? Tout le monde.',
      'Le jeton porte deux revendications à vérifier : pour qui il a été émis, et d’où il vient.',
      'Ajoute dans la `Condition` une clé `token.actions.githubusercontent.com:sub` qui nomme le dépôt et la référence, et une clé `…:aud` égale à `sts.amazonaws.com`.',
    ],
    fix: 'Condition sur le sujet avec le dépôt **et** la référence attendus, audience vérifiée. C’est le confused deputy de Kohnfelder en version AWS : le rôle agit pour le compte de qui le demande. Des recherches ont trouvé en 2023 des rôles de production assumables par tout dépôt public.',
  },
  {
    id: 'iam-oidc-org-wildcard', module: 'm15', title: 'Le joker d’organisation',
    status: 'live', kind: 'fix', level: 2, csslp: ['D1', 'D7'], cwe: 'CWE-1220',
    brief: 'La condition autorise tous les dépôts de l’organisation : un prototype créé par un stagiaire obtient le rôle de déploiement en production.',
    goal: 'Restreindre au dépôt et à l’environnement exacts, et prouver qu’un autre dépôt est refusé.',
    file: 'novafact/infra/iam/github-oidc.json',
    lessons: ['m15/l04', 'm15/l06'],
    hints: [
      'La condition existe. Relis ce qu’elle accepte exactement.',
      'Le sujet d’un jeton GitHub s’écrit `repo:<org>/<dépôt>:<ref | environment | pull_request>`.',
      'Remplace `repo:novafact/*:*` par le dépôt exact et la référence exacte — par exemple `repo:novafact/novafact:environment:production`. Aucun joker ne doit subsister dans le sujet.',
    ],
    fix: 'Un joker d’organisation transforme chaque nouveau dépôt en chemin d’accès à la production. L’environnement GitHub, avec son approbation, est le bon grain de séparation — et il se lit dans le sujet du jeton.',
  },
  {
    id: 'iam-external-id', module: 'm15', title: 'Accès inter-comptes sans ExternalId',
    status: 'live', kind: 'fix', level: 2, csslp: ['D1', 'D7'], cwe: 'CWE-441', k: [4],
    brief: 'Un rôle partenaire fait confiance au compte d’un tiers sans condition d’identifiant externe ni d’organisation.',
    goal: 'Ajouter la condition, et vérifier qu’aucune politique d’approbation inter-comptes n’en est dépourvue.',
    file: 'novafact/infra/iam/partner-role.json',
    lessons: ['m15/l06', 'm08/l04'],
    hints: [
      'Le prestataire a d’autres clients que toi, et il assume leurs rôles depuis le même compte.',
      'L’ARN d’un rôle n’est pas un secret : il suffit de le connaître pour demander au prestataire de s’en servir. AWS a créé une clé de condition pour exactement ce problème.',
      'Ajoute `"Condition": {"StringEquals": {"sts:ExternalId": "<secret convenu avec le partenaire>"}}` sur chaque approbation inter-comptes — ou `aws:PrincipalOrgID` quand le tiers est dans ton organisation.',
    ],
    fix: 'Sans identifiant externe, tout client du même prestataire peut demander à ce prestataire d’agir sur ton compte : c’est le confused deputy dans sa forme canonique, et AWS a créé cette condition exactement pour ça.',
  },
  {
    id: 'iam-not-action', module: 'm15', title: 'Le Deny qui ne refuse rien',
    status: 'live', kind: 'fix', level: 2, csslp: ['D1', 'D7'], cwe: 'CWE-183',
    brief: 'Un refus est écrit avec une négation d’action sur toutes les ressources : il ne protège rien d’utile et donne l’impression d’un garde-fou.',
    goal: 'Réécrire le refus en énumérant les actions sensibles, et justifier toute négation qui subsiste.',
    file: 'novafact/infra/iam/scp.json',
    lessons: ['m15/l01', 'm15/l06'],
    hints: [
      'Ce refus refuse tout… sauf une liste de treize services. Que reste-t-il de refusé ?',
      'Une politique en négation se lit à l’envers : au premier service ajouté dans la liste, elle ne protège plus rien — et supprimer l’instruction n’est pas la réécrire.',
      'Énumère les actions sensibles dans un `Deny` explicite : arrêt du journal d’audit, création d’utilisateur ou de clé d’accès, suppression de la limite de permission, suppression de clé KMS. Une négation qui subsiste doit être bornée par une `Condition`.',
    ],
    fix: 'Une politique en négation se lit à l’envers et se trompe de sens dès qu’on l’édite. Les refus explicites sont relisibles, testables, et se comparent d’une revue à l’autre.',
  },
  {
    id: 'iam-forallvalues', module: 'm15', title: 'L’opérateur qui échoue en ouvert',
    status: 'live', kind: 'fix', level: 3, csslp: ['D1', 'D7'], cwe: 'CWE-183',
    brief: 'Une politique restreint l’accès par un opérateur d’ensemble sur une clé mono-valuée : quand la clé est absente, l’opérateur renvoie vrai et l’appelant anonyme passe.',
    goal: 'Corriger l’opérateur, ou ajouter le refus qui traite explicitement l’absence de la clé.',
    file: 'novafact/infra/iam/invoices-bucket-policy.json',
    lessons: ['m15/l01', 'm15/l06'],
    hints: [
      'Que vaut « toutes les valeurs de cette clé sont dans la liste » quand la clé n’a aucune valeur ?',
      'Les opérateurs d’ensemble échouent en ouvert sur une clé absente — et `aws:PrincipalArn` est mono-valuée. Un appelant anonyme n’a pas d’ARN de principal.',
      'Retire le préfixe `ForAllValues:` (un simple `StringEquals` suffit), ou garde-le en ajoutant `"Null": {"aws:PrincipalArn": "false"}` — ou encore un `Deny` qui traite l’absence de la clé.',
    ],
    fix: 'Les opérateurs d’ensemble ont un comportement contre-intuitif sur une clé absente : c’est le piège du sixième challenge du Big IAM Challenge. Tester une politique avec le simulateur, et refuser explicitement ce qui n’est pas identifié.',
  },
  {
    id: 's3-bucket-policy-public', module: 'm15', title: 'Politique de bucket ouverte',
    status: 'live', kind: 'fix', level: 1, csslp: ['D1', 'D7'], cwe: 'CWE-732',
    brief: 'La politique du bucket des factures accorde la lecture à tout le monde, sans condition.',
    goal: 'Restreindre à la distribution qui doit y accéder, et retirer le droit de lister.',
    file: 'novafact/infra/iam/invoices-bucket-policy.json',
    lessons: ['m15/l01', 'm16/l01'],
    hints: [
      'Un `Principal` universel sans condition, ce n’est pas un accès : c’est une publication.',
      'Deux choses à corriger, pas une : qui peut lire, et le droit de lister le contenu du bucket.',
      'Remplace le principal `*` par le service CloudFront avec `"Condition": {"StringEquals": {"AWS:SourceArn": "<ARN de la distribution>"}}`, et supprime `s3:ListBucket`.',
    ],
    fix: 'Un principal universel sans condition est une publication. Accès par contrôle d’origine, condition sur l’ARN source, blocage d’accès public au niveau du compte. Le droit de lister un bucket est ce qui transforme une fuite en inventaire — c’est le premier niveau de flAWS.',
  },
  {
    id: 'ecs-task-vs-execution', module: 'm15', title: 'Rôle de tâche et rôle d’exécution confondus',
    status: 'live', kind: 'fix', level: 2, csslp: ['D1', 'D7'], cwe: 'CWE-269',
    brief: 'La définition de tâche utilise le même rôle pour tirer l’image et pour exécuter le code, et ce rôle lit tous les secrets du compte.',
    goal: 'Séparer les deux rôles et restreindre la lecture de secret à ceux dont l’application a besoin.',
    file: 'novafact/infra/ecs/task-definition.json',
    lessons: ['m15/l03', 'm17/l04'],
    hints: [
      'Deux rôles figurent dans une définition de tâche, et ils ne servent pas à la même chose.',
      'L’un est porté par l’agent qui démarre le conteneur ; l’autre est celui que ton code obtient via le service de métadonnées. Regarde aussi d’où viennent les secrets injectés.',
      'Donne à `executionRoleArn` un rôle distinct de `taskRoleArn`, et nomme chaque secret par son ARN complet dans `valueFrom` au lieu du joker.',
    ],
    fix: 'Le rôle d’exécution sert à l’agent pour démarrer le conteneur ; le rôle de tâche est celui que le code obtient. Les confondre donne au code applicatif les droits de la plateforme — et une exécution de code arbitraire lit alors tous les secrets. C’est la structure de la brèche Capital One.',
  },
  {
    id: 'kms-key-policy', module: 'm15', title: 'Politique de clé trop permissive',
    status: 'live', kind: 'fix', level: 2, csslp: ['D1', 'D7'], cwe: 'CWE-732', k: [5],
    brief: 'La politique de la clé de chiffrement accorde toutes les opérations à un principal universel, « parce que c’est plus simple ».',
    goal: 'Restreindre aux rôles nommés et au service appelant, sans casser le déchiffrement applicatif.',
    file: 'novafact/infra/iam/kms-key-policy.json',
    lessons: ['m15/l01', 'm08/l08'],
    hints: [
      'Le chiffrement au repos ne vaut que ce que vaut la politique de la clé.',
      'Deux choses à séparer : qui administre la clé, et qui s’en sert. Et personne ne doit être « tout le monde ». Attention : l’instruction du compte racine est le pivot voulu par AWS, la retirer rend la clé inutilisable.',
      'Garde l’instruction racine, puis nomme deux principaux : un rôle d’administration (actions de gestion seulement) et le rôle applicatif (`kms:Decrypt`, `kms:GenerateDataKey`) borné par `kms:ViaService`.',
    ],
    fix: 'Le chiffrement au repos ne vaut que ce que vaut la politique de la clé : si tout le monde peut déchiffrer, le chiffrement ne fait que cocher une case d’audit. Condition sur le service appelant, et séparation entre qui administre la clé et qui l’utilise.',
  },
  {
    id: 'permission-boundary', module: 'm15', title: 'La CI qui peut se fabriquer un admin',
    status: 'live', kind: 'fix', level: 3, csslp: ['D1', 'D7'], cwe: 'CWE-269',
    brief: 'Le rôle assumé par la CI peut créer des rôles et leur attacher des politiques, sans limite supérieure.',
    goal: 'Poser la limite de permission qui empêche la CI de créer plus de droits qu’elle n’en a.',
    file: 'novafact/infra/iam/deploy-role.json',
    lessons: ['m15/l04', 'm15/l06'],
    hints: [
      'Créer un rôle, lui attacher une politique : en deux appels, la CI devient ce qu’elle veut.',
      'IAM a une clé de condition qui borne les droits d’un principal créé, quelle que soit la politique qu’on lui attache ensuite.',
      'Ajoute `"Condition": {"StringEquals": {"iam:PermissionsBoundary": "arn:aws:iam::123456789012:policy/novafact-boundary"}}` sur la création **et** sur l’attachement — les deux instructions, pas seulement la première.',
    ],
    fix: 'Une limite de permission borne ce qu’un rôle créé peut obtenir, quelle que soit la politique qu’on lui attache. Sans elle, « créer un rôle » vaut « devenir administrateur » en deux appels. Condition imposant la limite sur les actions de création.',
  },
  {
    id: 'data-perimeter', module: 'm15', title: 'Le périmètre de données',
    status: 'live', kind: 'fix', level: 3, csslp: ['D4', 'D7'], cwe: 'CWE-732',
    brief: 'Rien n’empêche une identité du compte d’écrire dans un bucket qui n’appartient pas à l’organisation, ni une identité extérieure de lire les nôtres.',
    goal: 'Poser les trois périmètres — identité, ressource, réseau — et vérifier qu’ils tiennent ensemble.',
    file: 'novafact/infra/iam/scp.json',
    lessons: ['m15/l06', 'm15/l01'],
    hints: [
      'Une politique juste ne suffit pas : il faut que la prochaine, mal écrite, soit rattrapée.',
      'Trois questions, trois refus : quelles identités, quelles ressources, par quel réseau.',
      'Ajoute trois `Deny` conditionnés sur `aws:PrincipalOrgID`, `aws:ResourceOrgID` et `aws:SourceVpce` — et exempte les appels faits par les services AWS (`aws:ViaAWSService` / `aws:PrincipalIsAWSService`), sans quoi le périmètre casse la production et sera retiré au premier incident.',
    ],
    fix: 'Les conditions d’organisation, d’ARN source et de point de terminaison forment un filet qui rattrape ce que les politiques individuelles laissent passer. C’est ce qui transforme « chaque politique est juste » en « l’exfiltration est structurellement impossible » — et qui survit à la prochaine politique mal écrite.',
  },
];
