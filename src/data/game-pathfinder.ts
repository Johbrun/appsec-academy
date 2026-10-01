// Audits du jeu « IAM Privesc Pathfinder » (M15) : trouver l'instruction qui ouvre un chemin vers plus de droits,
// puis la correction qui le coupe. `fixes[0]` est la bonne correction (le composant mélange l'ordre).
//
// Règle d'écriture : **les quatre corrections doivent être de vraies mesures de
// durcissement**, formulées avec la même précision. Trois d'entre elles
// resserrent quelque chose de réel — un préfixe, une région, une condition — et
// laissent le chemin d'élévation intact. Si les mauvaises réponses se réduisent
// à « retirer tel droit », on les écarte sans avoir lu la politique, et l'audit
// ne s'apprend plus.
//
// `npm run games` vérifie que la bonne correction n'est pas la plus longue.
//
// ── Les niveaux ───────────────────────────────────────────────────────────────
// La difficulté ne tient pas au service, mais au **nombre de sauts** entre
// l'instruction et l'obtention de droits d'administrateur, et à la présence
// d'instructions leurres qui ont l'air aussi dangereuses.
//
//   N1 · Un seul saut. L'instruction à risque donne directement un droit
//        d'élévation (créer une clé, attacher une politique admin, lire un
//        secret d'identifiants). Les autres instructions sont clairement
//        bénignes. On apprend à reconnaître la primitive.
//
//   N2 · Deux sauts. Il faut enchaîner : passer un rôle à un service qu'on
//        contrôle, puis l'invoquer ; réécrire une ressource puis l'utiliser.
//        Au moins une instruction voisine est défendable et détourne l'œil.
//
//   N3 · Trois sauts, et une **impasse leurre** : une instruction qui paraît
//        être le chemin (un joker effrayant, un PassRole large) mais ne mène
//        nulle part, tandis que le vrai chemin passe par un détail — une action
//        qui n'exige pas iam:PassRole, une confiance trop ouverte, un script
//        de build modifiable. Le « plus visible » n'est pas le coupable.

export type Level = 1 | 2 | 3;
export type Statement = { sid: string; json: string };
export type PathAudit = {
  id: string;
  level: Level;
  tags?: string[];
  /** Audits de structure jumelle à ne pas réunir dans une même série. */
  avoid?: string[];
  role: string;
  purpose: string;
  statements: Statement[];
  risky: string; // sid
  path: string[];
  fixes: string[];
  why: string;
};

export const pathAudits: PathAudit[] = [
  // ── N1 : un seul saut, primitive directe ─────────────────────────────────
  {
    id: 'access-key',
    level: 1,
    tags: ['iam-write', 'real'],
    role: 'user-provisioner',
    purpose: 'Fonction Lambda qui crée les utilisateurs IAM des prestataires et leur remet des identifiants.',
    statements: [
      { sid: 'CreateUsers', json: `{ "Effect": "Allow", "Action": ["iam:CreateUser", "iam:AddUserToGroup"], "Resource": "arn:aws:iam::111122223333:user/contractors/*" }` },
      { sid: 'Keys', json: `{ "Effect": "Allow", "Action": "iam:CreateAccessKey", "Resource": "*" }` },
      { sid: 'Notify', json: `{ "Effect": "Allow", "Action": "ses:SendEmail", "Resource": "*" }` },
    ],
    risky: 'Keys',
    path: ['user-provisioner', 'iam:CreateAccessKey sur *', 'clé pour un utilisateur administrateur existant', 'administrateur'],
    fixes: [
      'Restreindre la création de clés au chemin user/contractors/*, comme les deux autres actions IAM',
      'Interdire AddUserToGroup vers les groupes d’administration, en nommant les groupes autorisés',
      'Limiter ses:SendEmail à l’identité vérifiée du domaine, pour éviter l’usurpation d’expéditeur',
      'Exécuter la fonction dans un sous-réseau privé, sans accès Internet sortant, pour couper toute exfiltration',
    ],
    why: 'La ressource « * » d’une seule action suffit : créer une clé d’accès pour un utilisateur, c’est agir en son nom, et rien n’empêche de viser un administrateur (méthode CreateAccessKey documentée par Rhino Security Labs, 2018). Le contraste est instructif — les deux autres actions IAM sont correctement bornées au chemin des prestataires, ce qui donne à la politique une apparence de rigueur.',
  },
  {
    id: 'attach-user-policy',
    level: 1,
    tags: ['iam-write', 'real'],
    avoid: ['put-user-policy'],
    role: 'helpdesk-tool',
    purpose: 'Outil du support informatique qui gère les groupes et les tags des utilisateurs internes.',
    statements: [
      { sid: 'Tagging', json: `{ "Effect": "Allow", "Action": ["iam:TagUser", "iam:UntagUser"], "Resource": "arn:aws:iam::111122223333:user/staff/*" }` },
      { sid: 'Grant', json: `{ "Effect": "Allow", "Action": "iam:AttachUserPolicy", "Resource": "*" }` },
      { sid: 'Read', json: `{ "Effect": "Allow", "Action": ["iam:GetUser", "iam:ListGroupsForUser"], "Resource": "*" }` },
    ],
    risky: 'Grant',
    path: ['helpdesk-tool', 'iam:AttachUserPolicy sur *', 'AdministratorAccess attaché à son propre utilisateur', 'administrateur'],
    fixes: [
      'Autoriser à n’attacher qu’une liste de politiques nommées par leur ARN, via une condition iam:PolicyARN',
      'Limiter AttachUserPolicy au chemin user/staff/*, cohérent avec la gestion des tags',
      'Remplacer la lecture large par les seules actions GetUser et ListGroupsForUser sur le personnel',
      'Journaliser chaque attachement de politique vers un bucket verrouillé, pour l’audit du support',
    ],
    why: 'Pouvoir attacher n’importe quelle politique gérée à n’importe quel utilisateur, c’est pouvoir s’attacher AdministratorAccess : un seul saut vers l’administration (méthode AttachUserPolicy, Rhino Security Labs 2018). Seule la condition iam:PolicyARN referme réellement le chemin ; borner le chemin des utilisateurs ne suffit pas si l’on peut se cibler soi-même.',
  },
  {
    id: 'put-user-policy',
    level: 1,
    tags: ['iam-write'],
    avoid: ['attach-user-policy'],
    role: 'onboarding-bot',
    purpose: 'Automatisation d’intégration qui pose les politiques inline de départ sur les nouveaux comptes.',
    statements: [
      { sid: 'Inline', json: `{ "Effect": "Allow", "Action": "iam:PutUserPolicy", "Resource": "*" }` },
      { sid: 'ListForCheck', json: `{ "Effect": "Allow", "Action": ["iam:ListUsers", "iam:ListUserPolicies"], "Resource": "*" }` },
      { sid: 'Welcome', json: `{ "Effect": "Allow", "Action": "sns:Publish", "Resource": "arn:aws:sns:eu-west-3:111122223333:welcome" }` },
    ],
    risky: 'Inline',
    path: ['onboarding-bot', 'iam:PutUserPolicy sur *', 'politique inline « Allow * sur * » posée sur soi', 'administrateur'],
    fixes: [
      'Restreindre PutUserPolicy au chemin des nouveaux comptes, en excluant les comptes existants',
      'Faire poser des politiques gérées prédéfinies plutôt que des politiques inline arbitraires',
      'Interdire au bot de se cibler lui-même, par une condition ArnNotEquals sur aws:PrincipalArn',
      'Exiger une revue humaine avant l’activation de tout compte doté d’une politique inline arbitraire',
    ],
    why: 'PutUserPolicy écrit une politique inline directement dans un utilisateur : le contenu est libre, donc un « Allow * sur * » posé sur soi-même donne l’administration en un saut. Contrairement à AttachUserPolicy, aucune condition iam:PolicyARN n’existe pour l’inline — d’où l’intérêt de forcer des politiques gérées prédéfinies, la première correction.',
  },
  {
    id: 'add-user-to-group',
    level: 1,
    tags: ['iam-write'],
    role: 'group-sync',
    purpose: 'Synchronisation annuaire → IAM : place chaque salarié dans les groupes correspondant à son service.',
    statements: [
      { sid: 'Membership', json: `{ "Effect": "Allow", "Action": "iam:AddUserToGroup", "Resource": "*" }` },
      { sid: 'ReadDir', json: `{ "Effect": "Allow", "Action": ["iam:ListGroups", "iam:GetGroup"], "Resource": "*" }` },
      { sid: 'Report', json: `{ "Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::novafact-hr-sync/*" }` },
    ],
    risky: 'Membership',
    path: ['group-sync', 'iam:AddUserToGroup sur *', 'ajout de soi au groupe Administrators', 'administrateur'],
    fixes: [
      'Nommer les groupes que la synchro peut peupler, et exclure explicitement les groupes d’administration',
      'Restreindre l’écriture du rapport au préfixe daté du jour, pour limiter les écrasements',
      'Faire tourner la synchro depuis le compte d’outillage, avec une condition aws:SourceAccount',
      'Chiffrer le rapport RH avec une clé KMS dédiée, dont la synchro n’a que l’usage de chiffrement',
    ],
    why: 'Un groupe IAM peut porter des politiques ; s’ajouter au groupe Administrators, c’est en hériter. Avec AddUserToGroup sur « * », rien n’interdit de viser ce groupe-là. Nommer les groupes autorisés est la seule correction qui coupe le saut — les trois autres durcissent le reste de la politique sans y toucher.',
  },
  {
    id: 'set-default-policy-version',
    level: 1,
    tags: ['iam-write'],
    role: 'policy-linter',
    purpose: 'Outil qui vérifie la conformité des politiques gérées et peut revenir à une version antérieure.',
    statements: [
      { sid: 'Inspect', json: `{ "Effect": "Allow", "Action": ["iam:GetPolicy", "iam:GetPolicyVersion", "iam:ListPolicyVersions"], "Resource": "*" }` },
      { sid: 'Rollback', json: `{ "Effect": "Allow", "Action": "iam:SetDefaultPolicyVersion", "Resource": "*" }` },
      { sid: 'Notify', json: `{ "Effect": "Allow", "Action": "sns:Publish", "Resource": "arn:aws:sns:eu-west-3:111122223333:policy-lint" }` },
    ],
    risky: 'Rollback',
    path: ['policy-linter', 'iam:SetDefaultPolicyVersion sur *', 'retour à une ancienne version très permissive', 'droits de cette version'],
    fixes: [
      'Retirer le retour arrière automatique : un changement de version passe par le pipeline et une revue',
      'Restreindre l’inspection aux politiques du périmètre audité, plutôt qu’à toutes les politiques',
      'Exiger que l’outil s’exécute depuis le compte d’audit, via une condition aws:SourceAccount',
      'Publier les alertes sur un sujet chiffré, dont le linter n’a que le droit de publication',
    ],
    why: 'Beaucoup de politiques gérées gardent d’anciennes versions plus larges que la version courante. Rendre par défaut une version ancienne (SetDefaultPolicyVersion) réactive ces droits sans rien réécrire — un saut, invisible dans l’historique du fichier (méthode SetDefaultPolicyVersion, Rhino Security Labs 2018). Le lecteur croit qu’auditer est inoffensif ; c’est le retour arrière qui élève.',
  },
  {
    id: 'create-login-profile',
    level: 1,
    tags: ['iam-write'],
    role: 'password-reset',
    purpose: 'Libre-service de réinitialisation : crée un mot de passe console pour les salariés qui n’en ont pas.',
    statements: [
      { sid: 'SetPassword', json: `{ "Effect": "Allow", "Action": "iam:CreateLoginProfile", "Resource": "arn:aws:iam::111122223333:user/*" }` },
      { sid: 'CheckMFA', json: `{ "Effect": "Allow", "Action": ["iam:ListMFADevices", "iam:GetLoginProfile"], "Resource": "*" }` },
      { sid: 'Log', json: `{ "Effect": "Allow", "Action": "cloudtrail:LookupEvents", "Resource": "*" }` },
    ],
    risky: 'SetPassword',
    path: ['password-reset', 'iam:CreateLoginProfile sur user/*', 'mot de passe console posé sur un admin sans profil', 'session console de l’admin'],
    fixes: [
      'Limiter la pose de mot de passe au chemin user/employees/*, en excluant les comptes techniques et admin',
      'Vérifier l’absence de MFA avant réinitialisation, plutôt que de seulement lister les appareils',
      'Exiger une validation par le responsable avant toute création de profil de connexion',
      'Conserver la trace CloudTrail dans un bucket en écriture unique, pour l’enquête a posteriori',
    ],
    why: 'CreateLoginProfile pose un mot de passe console sur un utilisateur qui n’en a pas — typiquement un compte technique ou d’administration à accès programmatique seul. On choisit alors son mot de passe et on ouvre sa session. Le chemin user/* couvre tout le monde ; seul le premier correctif, qui exclut les comptes sensibles, referme réellement.',
  },
  {
    id: 'secrets-read',
    level: 1,
    tags: ['resource-policy'],
    role: 'config-loader',
    purpose: 'Rôle applicatif qui charge la configuration de l’API depuis Secrets Manager au démarrage.',
    statements: [
      { sid: 'AppConfig', json: `{ "Effect": "Allow", "Action": "secretsmanager:GetSecretValue", "Resource": "*" }` },
      { sid: 'Cache', json: `{ "Effect": "Allow", "Action": ["elasticache:DescribeCacheClusters"], "Resource": "*" }` },
      { sid: 'Logs', json: `{ "Effect": "Allow", "Action": "logs:PutLogEvents", "Resource": "arn:aws:logs:eu-west-3:111122223333:log-group:/novafact/api:*" }` },
    ],
    risky: 'AppConfig',
    path: ['config-loader', 'secretsmanager:GetSecretValue sur *', 'lecture du secret contenant une clé d’admin', 'administrateur'],
    fixes: [
      'Restreindre la lecture aux seuls secrets prod/api/*, ceux dont l’application a besoin',
      'Décrire uniquement le cluster de l’application, plutôt que l’ensemble des clusters',
      'Attacher une politique de ressource à chaque secret, pour n’autoriser que les rôles attendus',
      'Chiffrer les secrets avec une clé KMS dont seul le rôle applicatif a l’usage de déchiffrement',
    ],
    why: 'Un GetSecretValue sur « * » lit tous les secrets du compte, y compris ceux qui stockent des clés d’accès d’administration ou des identifiants de service privilégié. Pas d’action IAM ici, pas de réécriture : juste une lecture trop large qui devient une élévation. Borner les ARN de secrets est le vrai correctif ; la politique de ressource (troisième option) aide mais ne se pose pas sur ce rôle.',
  },
  {
    id: 'ssm-param-creds',
    level: 1,
    tags: ['resource-policy'],
    avoid: ['secrets-read'],
    role: 'agent-bootstrap',
    purpose: 'Rôle d’amorçage des agents de monitoring, qui lit ses paramètres dans SSM Parameter Store.',
    statements: [
      { sid: 'Params', json: `{ "Effect": "Allow", "Action": ["ssm:GetParameter", "ssm:GetParametersByPath"], "Resource": "*" }` },
      { sid: 'Heartbeat', json: `{ "Effect": "Allow", "Action": "cloudwatch:PutMetricData", "Resource": "*" }` },
      { sid: 'Describe', json: `{ "Effect": "Allow", "Action": "ec2:DescribeInstances", "Resource": "*" }` },
    ],
    risky: 'Params',
    path: ['agent-bootstrap', 'ssm:GetParameter sur *', 'lecture d’un SecureString contenant une clé privilégiée', 'droits de cette clé'],
    fixes: [
      'Limiter la lecture au chemin /monitoring/*, celui des paramètres de l’agent',
      'Restreindre PutMetricData à l’espace de noms du monitoring, via une condition cloudwatch:namespace',
      'Chiffrer les paramètres sensibles avec une clé KMS distincte, hors de portée de l’agent',
      'Interdire GetParametersByPath récursif à la racine, pour éviter l’aspiration de tout l’arbre',
    ],
    why: 'Parameter Store sert souvent de coffre à secrets pour les scripts d’amorçage : un GetParameter sur « * » lit les SecureString de tout le compte, dont des clés d’accès privilégiées. La restriction de chemin est la seule qui coupe le saut ; le chiffrement KMS aide seulement si l’agent n’a pas aussi le droit de déchiffrement sur la clé.',
  },

  // ── N2 : deux sauts, un voisin défendable ────────────────────────────────
  {
    id: 'passrole',
    level: 2,
    tags: ['passrole', 'real'],
    role: 'ci-deployer',
    purpose: 'Rôle assumé par la CI pour déployer les fonctions Lambda de génération de PDF.',
    statements: [
      { sid: 'Artifacts', json: `{ "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject"], "Resource": "arn:aws:s3:::novafact-artifacts/*" }` },
      { sid: 'DeployFunctions', json: `{ "Effect": "Allow", "Action": ["lambda:CreateFunction", "lambda:UpdateFunctionCode", "lambda:InvokeFunction"], "Resource": "arn:aws:lambda:eu-west-3:111122223333:function:pdf-*" }` },
      { sid: 'PassExecutionRole', json: `{ "Effect": "Allow", "Action": "iam:PassRole", "Resource": "*" }` },
      { sid: 'Logs', json: `{ "Effect": "Allow", "Action": ["logs:CreateLogGroup", "logs:PutRetentionPolicy"], "Resource": "*" }` },
    ],
    risky: 'PassExecutionRole',
    path: ['ci-deployer', 'iam:PassRole sur *', 'fonction Lambda avec un rôle privilégié', 'droits de ce rôle'],
    fixes: [
      'Nommer le rôle d’exécution dans PassRole, avec iam:PassedToService = lambda.amazonaws.com',
      'Restreindre CreateFunction aux fonctions déjà déclarées dans le module Terraform du service',
      'Limiter les droits de journalisation au groupe /aws/lambda/pdf-* au lieu de la ressource *',
      'Conditionner le dépôt d’artefacts à aws:SourceArn, pour qu’il vienne du seul pipeline attendu',
    ],
    why: 'PassRole sur * permet de confier à une fonction qu’on crée n’importe quel rôle du compte, y compris un rôle administrateur, puis de l’invoquer pour agir avec ses droits (couple iam:PassRole + lambda:CreateFunction, méthode fondatrice de Rhino Security Labs, 2018). Les trois autres corrections sont bonnes à prendre et laissent ce chemin ouvert : ce n’est pas la création de la fonction qui élève les droits, c’est le rôle qu’on lui attache.',
  },
  {
    id: 'ec2-instance-profile',
    level: 2,
    tags: ['passrole'],
    role: 'infra-scaler',
    purpose: 'Rôle d’un outil interne qui ajuste la flotte EC2 selon la charge.',
    statements: [
      { sid: 'Fleet', json: `{ "Effect": "Allow", "Action": ["ec2:RunInstances", "ec2:TerminateInstances", "ec2:DescribeInstances"], "Resource": "*" }` },
      { sid: 'PassAny', json: `{ "Effect": "Allow", "Action": "iam:PassRole", "Resource": "*" }` },
      { sid: 'Profiles', json: `{ "Effect": "Allow", "Action": "iam:AddRoleToInstanceProfile", "Resource": "*" }` },
    ],
    risky: 'PassAny',
    path: ['infra-scaler', 'iam:PassRole sur *', 'instance EC2 lancée avec un profil administrateur', 'commande via SSM ou métadonnées → droits du rôle'],
    fixes: [
      'Nommer les rôles passables et exiger iam:PassedToService = ec2.amazonaws.com dans PassRole',
      'Restreindre RunInstances aux sous-réseaux et types d’instance de la flotte applicative',
      'Limiter AddRoleToInstanceProfile aux profils portant le tag de l’équipe, via iam:ResourceTag',
      'Exiger IMDSv2 sur toute instance lancée, pour durcir l’accès au service de métadonnées',
    ],
    why: 'Lancer une EC2 avec un profil d’instance qui porte un rôle admin, puis lire ce rôle par les métadonnées de l’instance, donne ses droits : c’est le couple iam:PassRole + ec2:RunInstances. Exiger IMDSv2 durcit l’accès aux métadonnées mais n’empêche pas l’instance légitime de récupérer le rôle passé — seule la restriction de PassRole coupe le chemin.',
  },
  {
    id: 'glue-passrole',
    level: 2,
    tags: ['passrole'],
    role: 'data-engineer',
    purpose: 'Rôle de l’équipe data pour développer et lancer des jobs AWS Glue.',
    statements: [
      { sid: 'GlueDev', json: `{ "Effect": "Allow", "Action": ["glue:CreateDevEndpoint", "glue:UpdateDevEndpoint", "glue:CreateJob"], "Resource": "*" }` },
      { sid: 'PassGlue', json: `{ "Effect": "Allow", "Action": "iam:PassRole", "Resource": "*" }` },
      { sid: 'Catalog', json: `{ "Effect": "Allow", "Action": ["glue:GetTable", "glue:GetDatabase"], "Resource": "*" }` },
    ],
    risky: 'PassGlue',
    path: ['data-engineer', 'iam:PassRole sur *', 'endpoint Glue de développement avec un rôle privilégié', 'shell sur l’endpoint → droits du rôle'],
    fixes: [
      'Restreindre PassRole aux rôles Glue nommés, avec iam:PassedToService = glue.amazonaws.com',
      'Limiter la création de jobs aux projets déclarés dans le dépôt d’infrastructure de l’équipe',
      'Réduire l’accès au catalogue aux bases analytiques, plutôt qu’à toutes les tables Glue',
      'Interdire les DevEndpoint en production et n’autoriser que l’environnement de développement',
    ],
    why: 'Un DevEndpoint Glue offre un shell qui s’exécute avec le rôle passé à Glue : passer un rôle privilégié, c’est obtenir ses droits depuis ce shell (couple iam:PassRole + glue:CreateDevEndpoint). Interdire les endpoints en production réduit l’exposition mais laisse le chemin ouvert en développement, où des rôles sensibles traînent souvent aussi.',
  },
  {
    id: 'sagemaker-passrole',
    level: 2,
    tags: ['passrole', 'compute'],
    role: 'ml-engineer',
    purpose: 'Rôle de l’équipe science des données pour lancer des notebooks SageMaker d’entraînement.',
    statements: [
      { sid: 'Notebooks', json: `{ "Effect": "Allow", "Action": ["sagemaker:CreateNotebookInstance", "sagemaker:CreatePresignedNotebookInstanceUrl"], "Resource": "*" }` },
      { sid: 'PassSage', json: `{ "Effect": "Allow", "Action": "iam:PassRole", "Resource": "*" }` },
      { sid: 'TrainData', json: `{ "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::novafact-ml-datasets/*" }` },
    ],
    risky: 'PassSage',
    path: ['ml-engineer', 'iam:PassRole sur *', 'notebook SageMaker doté d’un rôle privilégié', 'shell du notebook → droits du rôle'],
    fixes: [
      'Nommer les rôles passables et exiger iam:PassedToService = sagemaker.amazonaws.com',
      'Restreindre la création de notebooks au sous-réseau isolé prévu pour l’entraînement',
      'Limiter l’accès aux jeux de données au préfixe de l’équipe, plutôt qu’à tout le compartiment',
      'Interdire l’URL présignée de notebook, qui ouvre l’accès au shell depuis l’extérieur',
    ],
    why: 'Un notebook SageMaker offre un shell Jupyter qui s’exécute avec le rôle passé à l’instance : passer un rôle privilégié, c’est obtenir ses droits depuis le notebook (couple iam:PassRole + sagemaker:CreateNotebookInstance). Isoler le réseau ou fermer l’URL présignée gêne l’accès, mais le rôle reste sur-privilégié — seule la restriction de PassRole coupe le saut.',
  },
  {
    id: 'policy-version',
    level: 2,
    tags: ['iam-write'],
    role: 'support-tools',
    purpose: 'Rôle de l’outil interne du support, qui lit des journaux et gère ses propres réglages.',
    statements: [
      { sid: 'ReadLogs', json: `{ "Effect": "Allow", "Action": ["logs:FilterLogEvents", "logs:GetLogEvents"], "Resource": "arn:aws:logs:eu-west-3:111122223333:log-group:/novafact/api:*" }` },
      { sid: 'ManageOwnPolicy', json: `{ "Effect": "Allow", "Action": ["iam:CreatePolicyVersion", "iam:SetDefaultPolicyVersion"], "Resource": "arn:aws:iam::111122223333:policy/support-tools-policy" }` },
      { sid: 'ReadTickets', json: `{ "Effect": "Allow", "Action": "dynamodb:Query", "Resource": "arn:aws:dynamodb:eu-west-3:111122223333:table/support-tickets" }` },
    ],
    risky: 'ManageOwnPolicy',
    path: ['support-tools', 'nouvelle version de sa propre politique', 'politique réécrite avec « * »', 'administrateur'],
    fixes: [
      'Retirer la gestion de politiques : elles ne changent que par le pipeline d’infrastructure',
      'Poser une permissions boundary sur le rôle, pour plafonner ce que sa politique peut lui accorder',
      'Restreindre la lecture des journaux aux flux de l’API, et exiger un ticket ouvert en condition',
      'Limiter les requêtes DynamoDB aux enregistrements du client concerné avec dynamodb:LeadingKeys',
    ],
    why: 'Un rôle qui peut publier une nouvelle version de sa propre politique et la rendre active peut s’accorder n’importe quel droit : la ressource est pourtant bien nommée, et c’est ce qui trompe (méthode CreatePolicyVersion, Rhino Security Labs 2018). La boundary serait le bon plafond — elle est ici la deuxième meilleure réponse, pas la première, car le droit n’a aucune raison d’exister.',
  },
  {
    id: 'attach-policy',
    level: 2,
    tags: ['iam-write'],
    role: 'dev-team',
    purpose: 'Rôle des développeurs dans le compte de développement : ils créent les rôles de leurs services.',
    statements: [
      { sid: 'CreateServiceRoles', json: `{ "Effect": "Allow", "Action": ["iam:CreateRole", "iam:AttachRolePolicy", "iam:PutRolePolicy"], "Resource": "arn:aws:iam::111122223333:role/dev-*" }` },
      { sid: 'Compute', json: `{ "Effect": "Allow", "Action": ["lambda:*", "ecs:*"], "Resource": "*" }` },
      { sid: 'ReadOnly', json: `{ "Effect": "Allow", "Action": ["cloudwatch:Get*", "cloudwatch:List*"], "Resource": "*" }` },
    ],
    risky: 'CreateServiceRoles',
    path: ['dev-team', 'crée un rôle dev-* et y attache AdministratorAccess', 'rôle dev-* administrateur', 'administrateur du compte'],
    fixes: [
      'Exiger une boundary sur tout rôle créé, et limiter les politiques attachables par iam:PolicyARN',
      'Restreindre lambda:* et ecs:* à eu-west-3 et aux ressources portant le tag d’équipe du demandeur',
      'Remplacer cloudwatch:Get* et List* par les actions nommées dont les tableaux de bord ont besoin',
      'Interdire iam:PutRolePolicy et ne laisser que l’attachement de politiques gérées, plus traçable',
    ],
    why: 'Déléguer la création de rôles est utile et normal en compte de développement. Sans boundary obligatoire, un rôle créé peut recevoir plus de droits que son créateur — y compris AdministratorAccess. La dernière correction réduit la surface sans rien plafonner : une politique gérée peut être AdministratorAccess.',
  },
  {
    id: 'ssm',
    level: 2,
    tags: ['compute'],
    role: 'api-task',
    purpose: 'Rôle des tâches ECS de l’API Express. Un développeur a ajouté un droit « pour déboguer ».',
    statements: [
      { sid: 'Invoices', json: `{ "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject"], "Resource": "arn:aws:s3:::novafact-invoices/*" }` },
      { sid: 'Queue', json: `{ "Effect": "Allow", "Action": "sqs:SendMessage", "Resource": "arn:aws:sqs:eu-west-3:111122223333:pdf-jobs" }` },
      { sid: 'Debug', json: `{ "Effect": "Allow", "Action": "ssm:SendCommand", "Resource": "*" }` },
    ],
    risky: 'Debug',
    path: ['api-task', 'ssm:SendCommand sur *', 'commandes sur d’autres instances', 'rôles de ces instances'],
    fixes: [
      'Sortir ce droit du rôle applicatif : le débogage passe par un rôle humain nominatif et temporaire',
      'Restreindre SendCommand aux instances portant le tag Environment=staging, via ssm:ResourceTag',
      'Limiter l’accès S3 au préfixe pdf/ des factures, plutôt qu’à l’ensemble du compartiment',
      'Exiger aws:SecureTransport sur la file SQS et chiffrer les messages avec une clé KMS dédiée',
    ],
    why: 'Exécuter une commande sur une instance gérée, c’est s’exécuter avec le rôle de cette instance : une API exposée à Internet ne doit jamais porter ce droit, même restreint. La deuxième correction est d’ailleurs séduisante et insuffisante — un tag se modifie, et staging finit par contenir une copie des données de production.',
  },
  {
    id: 'update-trust',
    level: 2,
    tags: ['trust', 'iam-write'],
    role: 'iam-janitor',
    purpose: 'Rôle d’une fonction de ménage qui supprime les rôles inutilisés depuis 90 jours.',
    statements: [
      { sid: 'Inventory', json: `{ "Effect": "Allow", "Action": ["iam:ListRoles", "iam:GetRole", "iam:GetRoleLastUsed"], "Resource": "*" }` },
      { sid: 'Cleanup', json: `{ "Effect": "Allow", "Action": ["iam:DeleteRole", "iam:UpdateAssumeRolePolicy"], "Resource": "*" }` },
      { sid: 'Report', json: `{ "Effect": "Allow", "Action": "sns:Publish", "Resource": "arn:aws:sns:eu-west-3:111122223333:iam-cleanup" }` },
    ],
    risky: 'Cleanup',
    path: ['iam-janitor', 'iam:UpdateAssumeRolePolicy sur n’importe quel rôle', 'confiance réécrite vers soi', 'rôle administrateur assumé'],
    fixes: [
      'Retirer UpdateAssumeRolePolicy : supprimer un rôle n’exige pas de réécrire sa politique de confiance',
      'Restreindre la suppression aux rôles portant le tag Managed=janitor, via une condition iam:ResourceTag',
      'Faire produire à la fonction une proposition de suppression, appliquée par le pipeline après revue',
      'Exiger que la fonction s’exécute depuis le compte d’outillage, avec une condition sur aws:SourceAccount',
    ],
    why: 'UpdateAssumeRolePolicy est passé inaperçu parce qu’il voisine avec DeleteRole, une action de ménage légitime. Il permet pourtant de réécrire la confiance de n’importe quel rôle — y compris administrateur — pour se l’accorder à soi-même, puis de l’assumer. La troisième correction serait excellente si la première n’existait pas.',
  },
  {
    id: 'lambda-code',
    level: 2,
    tags: ['compute'],
    role: 'oncall-responder',
    purpose: 'Rôle d’astreinte, prévu pour redéployer rapidement une fonction en cas d’incident.',
    statements: [
      { sid: 'Observe', json: `{ "Effect": "Allow", "Action": ["cloudwatch:GetMetricData", "logs:FilterLogEvents"], "Resource": "*" }` },
      { sid: 'Rollback', json: `{ "Effect": "Allow", "Action": ["lambda:UpdateFunctionCode", "lambda:PublishVersion"], "Resource": "arn:aws:lambda:eu-west-3:111122223333:function:*" }` },
      { sid: 'Notify', json: `{ "Effect": "Allow", "Action": "chatbot:*", "Resource": "*" }` },
    ],
    risky: 'Rollback',
    path: ['oncall-responder', 'UpdateFunctionCode sur toutes les fonctions', 'code déposé dans la fonction billing-reconciler', 'rôle d’exécution de cette fonction'],
    fixes: [
      'Restreindre le redéploiement aux fonctions de l’équipe d’astreinte, et non à toutes celles du compte',
      'Exiger que le code déployé provienne du compartiment d’artefacts signés du pipeline de livraison',
      'Remplacer UpdateFunctionCode par lambda:UpdateAlias, pour ne pointer que des versions déjà publiées',
      'Restreindre chatbot:* aux seules actions de publication sur le canal d’incident, au lieu du joker actuel',
    ],
    why: 'Modifier le code d’une fonction, c’est exécuter ce qu’on veut avec son rôle d’exécution : la fonction de rapprochement bancaire en a un bien plus large que l’astreinte. Les deuxième et troisième corrections sont bonnes et partielles — l’une contrôle la provenance, l’autre le mécanisme, aucune ne réduit le périmètre.',
  },
  {
    id: 'login-profile',
    level: 2,
    tags: ['iam-write'],
    avoid: ['create-login-profile'],
    role: 'hr-offboarding',
    purpose: 'Automatisation RH : désactive les accès d’un salarié le jour de son départ.',
    statements: [
      { sid: 'Disable', json: `{ "Effect": "Allow", "Action": ["iam:DeleteAccessKey", "iam:DeactivateMFADevice"], "Resource": "arn:aws:iam::111122223333:user/*" }` },
      { sid: 'Reset', json: `{ "Effect": "Allow", "Action": ["iam:UpdateLoginProfile", "iam:CreateLoginProfile"], "Resource": "arn:aws:iam::111122223333:user/*" }` },
      { sid: 'Audit', json: `{ "Effect": "Allow", "Action": "cloudtrail:LookupEvents", "Resource": "*" }` },
    ],
    risky: 'Reset',
    path: ['hr-offboarding', 'UpdateLoginProfile sur n’importe quel utilisateur', 'mot de passe console choisi par l’attaquant', 'session console de cet utilisateur'],
    fixes: [
      'Supprimer la gestion des mots de passe : un départ se traite en retirant l’accès, pas en le changeant',
      'Limiter toutes les actions au chemin user/employees/*, en excluant explicitement les comptes de rupture',
      'Exiger la MFA sur la session qui déclenche l’automatisation, avec une condition aws:MultiFactorAuthPresent',
      'Journaliser chaque exécution dans un compartiment verrouillé en écriture unique, pour l’audit RH',
    ],
    why: 'Changer le mot de passe console d’un utilisateur, c’est prendre sa place : le droit paraît cohérent avec un départ, et il permet de viser l’administrateur au lieu du partant. La deuxième correction est tentante — elle ne tient que tant que personne ne range un administrateur sous le mauvais chemin.',
  },

  // ── N3 : trois sauts, une impasse leurre ─────────────────────────────────
  {
    id: 'trust',
    level: 3,
    tags: ['trust'],
    role: 'prod-break-glass',
    purpose: 'Rôle administrateur d’urgence en production. Sa politique de confiance est affichée en premier.',
    statements: [
      { sid: 'TrustPolicy', json: `{ "Effect": "Allow", "Principal": { "AWS": "arn:aws:iam::111122223333:root" }, "Action": "sts:AssumeRole" }` },
      { sid: 'AdminAccess', json: `{ "Effect": "Allow", "Action": "*", "Resource": "*" }` },
      { sid: 'CiAssume (sur le rôle ci-runner)', json: `{ "Effect": "Allow", "Action": "sts:AssumeRole", "Resource": "*" }` },
    ],
    risky: 'CiAssume (sur le rôle ci-runner)',
    path: ['ci-runner', 'sts:AssumeRole sur *', 'confiance accordée à tout le compte', 'prod-break-glass'],
    fixes: [
      'Énumérer les rôles que le runner peut assumer, et exiger la MFA dans la confiance du break-glass',
      'Remplacer AdministratorAccess par un jeu d’actions d’urgence, révisé après chaque exercice de crise',
      'Réduire la durée maximale de session à une heure, pour raccourcir la fenêtre d’un jeton volé',
      'Conditionner la confiance à aws:SourceIdentity, afin de savoir qui se cache derrière la session',
    ],
    why: 'Une confiance accordée à la racine du compte ne restreint rien : elle délègue la décision aux politiques d’identité, et il suffit alors d’un principal autorisé à assumer « * ». Les trois autres corrections limitent les dégâts une fois le rôle assumé ; seule la première empêche de l’assumer. L’AdministratorAccess affiché est un leurre : c’est le rôle-cible, pas le chemin.',
  },
  {
    id: 'state-bucket',
    level: 3,
    tags: ['resource-policy', 'real'],
    role: 'terraform-plan',
    purpose: 'Rôle du job de planification Terraform, qui tourne sur chaque pull request.',
    statements: [
      { sid: 'ReadState', json: `{ "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::novafact-tfstate/*" }` },
      { sid: 'Lock', json: `{ "Effect": "Allow", "Action": ["dynamodb:PutItem", "dynamodb:DeleteItem"], "Resource": "arn:aws:dynamodb:eu-west-3:111122223333:table/tf-locks" }` },
      { sid: 'Describe', json: `{ "Effect": "Allow", "Action": ["ec2:Describe*", "rds:Describe*", "iam:Get*", "iam:List*"], "Resource": "*" }` },
    ],
    risky: 'ReadState',
    path: ['terraform-plan (déclenché par une PR externe)', 'lecture du fichier d’état', 'mots de passe RDS et clés en clair dans l’état', 'accès direct aux bases'],
    fixes: [
      'Chiffrer l’état avec une clé KMS dont le job de plan n’a pas l’usage, et sortir les secrets de l’état',
      'N’exécuter le job de plan que sur les pull requests provenant de branches du dépôt, jamais des forks',
      'Restreindre les actions Describe aux services réellement décrits par les modules du dépôt',
      'Séparer les tables de verrou par environnement, pour qu’un plan ne bloque jamais les autres pipelines',
    ],
    why: 'Le fichier d’état Terraform contient en clair tout ce que les ressources ont produit : mots de passe générés, clés, chaînes de connexion. C’est exactement le pivot de la campagne SCARLETEEL (Sysdig, 2023), où des fichiers d’état lus dans un bucket S3 ont livré les clés d’un second compte. Ce n’est pas une action IAM qui élève ici, mais une lecture — et c’est ce qui rend l’audit difficile. La deuxième correction ferme le déclencheur externe sans refermer l’état lui-même.',
  },
  {
    id: 'kms-policy',
    level: 3,
    tags: ['resource-policy'],
    role: 'data-platform',
    purpose: 'Rôle de la plateforme de données, qui gère ses propres clés de chiffrement.',
    statements: [
      { sid: 'Analytics', json: `{ "Effect": "Allow", "Action": ["athena:StartQueryExecution", "glue:GetTable"], "Resource": "*" }` },
      { sid: 'OwnKeys', json: `{ "Effect": "Allow", "Action": ["kms:PutKeyPolicy", "kms:DescribeKey"], "Resource": "*" }` },
      { sid: 'Results', json: `{ "Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::novafact-athena-results/*" }` },
    ],
    risky: 'OwnKeys',
    path: ['data-platform', 'kms:PutKeyPolicy sur toutes les clés', 'politique de la clé des sauvegardes réécrite', 'déchiffrement des sauvegardes de production'],
    fixes: [
      'Borner PutKeyPolicy aux clés portant le tag Owner=data-platform, sinon les clés d’autrui sont ouvertes',
      'Interdire au rôle de se nommer lui-même dans une politique de clé, par une condition sur kms:GrantIsForAWSResource',
      'Limiter les requêtes Athena aux bases du catalogue analytique, plutôt qu’à toutes les tables Glue',
      'Chiffrer le compartiment de résultats avec une clé distincte de celle des données sources',
    ],
    why: 'La politique d’une clé KMS est la seule chose qui décide de qui peut déchiffrer : pouvoir la réécrire sur toutes les clés du compte contourne toutes les politiques IAM du monde. Le piège est que le rôle a une raison légitime de gérer ses clés — la faute est dans la ressource, pas dans l’action.',
  },
  {
    id: 'codebuild',
    level: 3,
    tags: ['passrole', 'compute'],
    role: 'release-manager',
    purpose: 'Rôle humain de l’équipe de livraison, qui déclenche et ajuste les builds de release.',
    statements: [
      { sid: 'Builds', json: `{ "Effect": "Allow", "Action": ["codebuild:StartBuild", "codebuild:UpdateProject"], "Resource": "arn:aws:codebuild:eu-west-3:111122223333:project/release-*" }` },
      { sid: 'PassBuildRole', json: `{ "Effect": "Allow", "Action": "iam:PassRole", "Resource": "arn:aws:iam::111122223333:role/codebuild-*" }` },
      { sid: 'Artifacts', json: `{ "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::novafact-releases/*" }` },
    ],
    risky: 'Builds',
    path: ['release-manager', 'UpdateProject change la commande de build', 'build exécuté avec le rôle codebuild-prod-deploy', 'droits de déploiement en production'],
    fixes: [
      'Retirer UpdateProject : la définition des projets appartient au dépôt d’infrastructure',
      'Restreindre PassRole au seul rôle codebuild-release, au lieu de l’ensemble du préfixe codebuild-*',
      'Exiger que la source du build soit une étiquette signée du dépôt, et non une branche arbitraire',
      'Limiter le démarrage des builds aux heures ouvrées via aws:CurrentTime, pour encadrer les livraisons',
    ],
    why: 'Pouvoir modifier la définition d’un projet CodeBuild revient à choisir les commandes exécutées avec le rôle du projet : le PassRole correctement borné n’y change rien, puisque le rôle visé est déjà dans le préfixe autorisé. Les deux instructions sont bornées, et le chemin passe entre les deux.',
  },
  {
    id: 'cloudformation-updatestack',
    level: 3,
    tags: ['real', 'passrole'],
    role: 'stack-operator',
    purpose: 'Rôle d’exploitation qui met à jour des stacks CloudFormation existantes, sans droit iam:PassRole.',
    statements: [
      { sid: 'Stacks', json: `{ "Effect": "Allow", "Action": ["cloudformation:UpdateStack", "cloudformation:DescribeStacks"], "Resource": "arn:aws:cloudformation:eu-west-3:111122223333:stack/*" }` },
      { sid: 'ReadTemplates', json: `{ "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::novafact-cfn-templates/*" }` },
      { sid: 'NoPassRole', json: `{ "Effect": "Deny", "Action": "iam:PassRole", "Resource": "*" }` },
    ],
    risky: 'Stacks',
    path: ['stack-operator', 'cloudformation:UpdateStack sur une stack liée à un rôle de service admin', 'gabarit malveillant appliqué par ce rôle', 'ressources IAM créées avec ses droits'],
    fixes: [
      'Restreindre UpdateStack aux stacks portant le tag de l’équipe, via une condition cloudformation:ResourceTag',
      'Exiger que le gabarit provienne du compartiment interne signé, via la condition cloudformation:TemplateUrl',
      'Interdire la mise à jour des stacks dont le rôle de service dépasse le périmètre de l’équipe',
      'Activer une politique de stack qui gèle les ressources IAM contre toute modification par mise à jour',
    ],
    why: 'CloudFormation réutilise le rôle de service déjà associé à une stack, même si l’appelant n’a pas iam:PassRole : le Deny sur PassRole est un leurre, il ne protège pas ici (comportement documenté ; méthode UpdateStack de HackTricks Cloud). Mettre à jour la stack avec un gabarit malveillant fait agir ce rôle — souvent large — pour créer des ressources IAM. Restreindre les stacks accessibles est la première barrière.',
  },
  {
    id: 'codebuild-buildspec',
    level: 3,
    tags: ['real', 'compute'],
    avoid: ['codebuild'],
    role: 'build-trigger',
    purpose: 'Rôle qui déclenche les builds existants ; il ne peut ni créer ni modifier de projet.',
    statements: [
      { sid: 'Start', json: `{ "Effect": "Allow", "Action": "codebuild:StartBuild", "Resource": "arn:aws:codebuild:eu-west-3:111122223333:project/*" }` },
      { sid: 'NoEdit', json: `{ "Effect": "Deny", "Action": ["codebuild:UpdateProject", "codebuild:CreateProject"], "Resource": "*" }` },
      { sid: 'Status', json: `{ "Effect": "Allow", "Action": "codebuild:BatchGetBuilds", "Resource": "*" }` },
    ],
    risky: 'Start',
    path: ['build-trigger', 'codebuild:StartBuild avec buildspecOverride', 'commandes arbitraires dans le build', 'rôle de service du projet CodeBuild'],
    fixes: [
      'Refuser StartBuild quand un buildspec est fourni, via un Deny conditionné sur codebuild:source.buildspec',
      'Limiter StartBuild aux projets de l’équipe, plutôt qu’à tous les projets du compte',
      'Exiger que la source du build soit la branche protégée du dépôt, jamais une référence arbitraire',
      'Restreindre BatchGetBuilds aux builds de l’équipe, pour ne pas exposer les journaux des autres',
    ],
    why: 'StartBuild accepte un buildspecOverride : on injecte ses propres commandes sans jamais modifier le projet, donc le Deny sur UpdateProject/CreateProject ne sert à rien — c’est le leurre. Les commandes s’exécutent avec le rôle de service du projet. La parade exacte est un Deny avec l’opérateur Null sur codebuild:source.buildspec, qui refuse tout override (condition documentée par AWS).',
  },
  {
    id: 'github-oidc-trust',
    level: 3,
    tags: ['trust', 'real'],
    role: 'gha-deployer',
    purpose: 'Rôle assumé par GitHub Actions via OIDC pour déployer l’application.',
    statements: [
      { sid: 'TrustPolicy', json: `{ "Effect": "Allow", "Principal": { "Federated": "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com" }, "Action": "sts:AssumeRoleWithWebIdentity", "Condition": { "StringLike": { "token.actions.githubusercontent.com:sub": "repo:*" } } }` },
      { sid: 'Deploy', json: `{ "Effect": "Allow", "Action": ["s3:PutObject", "cloudfront:CreateInvalidation", "lambda:UpdateFunctionCode"], "Resource": "*" }` },
      { sid: 'AudLock', json: `{ "Effect": "Allow", "Action": "logs:PutLogEvents", "Resource": "arn:aws:logs:eu-west-3:111122223333:log-group:/gha/*" }` },
    ],
    risky: 'TrustPolicy',
    path: ['n’importe quel dépôt GitHub', 'sub « repo:* » accepté par la confiance', 'workflow externe qui assume gha-deployer', 'droits de déploiement du rôle'],
    fixes: [
      'Restreindre le sub à repo:novafact/app:ref:refs/heads/main, le dépôt et la branche attendus',
      'Vérifier aussi l’audience token avec une condition sur :aud égale à sts.amazonaws.com',
      'Réduire les droits de déploiement aux ressources nommées de l’application, non à toutes',
      'Réduire la durée maximale de session, pour raccourcir la fenêtre d’un jeton OIDC détourné',
    ],
    why: 'La condition sur le sub accepte « repo:* » : n’importe quel dépôt GitHub du monde peut faire assumer ce rôle par OIDC, car le fournisseur est public. C’est la mauvaise configuration OIDC la plus répandue. Vérifier l’audience est utile mais insuffisant : tous les jetons GitHub portent la même aud — seule la restriction du sub au dépôt et à la branche ferme la porte.',
  },
  {
    id: 'chain-assume',
    level: 3,
    tags: ['trust', 'iam-write'],
    role: 'automation-hub',
    purpose: 'Rôle d’orchestration qui pilote des rôles intermédiaires par service.',
    statements: [
      { sid: 'AssumeWorkers', json: `{ "Effect": "Allow", "Action": "sts:AssumeRole", "Resource": "arn:aws:iam::111122223333:role/worker-*" }` },
      { sid: 'BroadReadWrite', json: `{ "Effect": "Allow", "Action": ["s3:*", "sqs:*", "dynamodb:*"], "Resource": "*" }` },
      { sid: 'Schedule', json: `{ "Effect": "Allow", "Action": ["events:PutRule", "events:PutTargets"], "Resource": "*" }` },
    ],
    risky: 'AssumeWorkers',
    path: ['automation-hub', 'assume worker-iam (dans le préfixe worker-*)', 'worker-iam porte iam:PutRolePolicy', 'politique inline admin posée sur soi'],
    fixes: [
      'Nommer précisément les rôles assumables au lieu du préfixe worker-*, qui englobe worker-iam',
      'Poser une permissions boundary sur les rôles worker-*, pour plafonner ce qu’ils peuvent accorder',
      'Restreindre les accès S3, SQS et DynamoDB aux ressources portant le tag du service concerné',
      'Limiter events:PutTargets aux cibles déjà déclarées, pour éviter le détournement de règles',
    ],
    why: 'Le préfixe worker-* paraît anodin, mais il inclut worker-iam, un rôle qui détient iam:PutRolePolicy. La chaîne fait trois sauts : assumer worker-iam, lui faire écrire une politique inline admin, agir en administrateur. Les accès S3/SQS/DynamoDB larges sont le leurre — bruyants mais sans élévation. C’est un rôle assumable de trop qui ouvre le chemin.',
  },
  {
    id: 'ssm-start-session',
    level: 3,
    tags: ['compute'],
    avoid: ['ssm'],
    role: 'support-shell',
    purpose: 'Rôle du support N3 qui ouvre des sessions interactives sur les instances pour diagnostiquer.',
    statements: [
      { sid: 'Sessions', json: `{ "Effect": "Allow", "Action": "ssm:StartSession", "Resource": "*" }` },
      { sid: 'ReadOnly', json: `{ "Effect": "Allow", "Action": ["ec2:DescribeInstances", "ssm:DescribeInstanceInformation"], "Resource": "*" }` },
      { sid: 'Tickets', json: `{ "Effect": "Allow", "Action": "dynamodb:GetItem", "Resource": "arn:aws:dynamodb:eu-west-3:111122223333:table/support-tickets" }` },
    ],
    risky: 'Sessions',
    path: ['support-shell', 'ssm:StartSession sur toute instance', 'shell sur une instance à profil privilégié', 'récupération du rôle par les métadonnées'],
    fixes: [
      'Restreindre StartSession aux instances portant le tag SupportManaged=true, via ssm:resourceTag',
      'Limiter la lecture d’inventaire aux instances de l’équipe, plutôt qu’à toute la flotte',
      'Enregistrer les sessions dans un bucket verrouillé, pour tracer chaque commande exécutée',
      'Exiger IMDSv2 sur les instances, pour durcir l’accès au service de métadonnées',
    ],
    why: 'Une session SSM ouvre un shell dans l’instance, avec les droits de son profil : viser une instance qui porte un rôle privilégié, puis lire ce rôle par les métadonnées, donne ses droits. StartSession sur « * » n’exclut aucune instance. L’enregistrement des sessions et IMDSv2 aident à tracer ou durcir, mais ne referment pas le périmètre — seul le tag de ressource le fait.',
  },
  {
    id: 'glue-job-update',
    level: 3,
    tags: ['compute', 'passrole'],
    avoid: ['glue-passrole'],
    role: 'etl-scheduler',
    purpose: 'Rôle qui planifie et ajuste les jobs Glue existants ; il ne peut pas créer de nouveau rôle.',
    statements: [
      { sid: 'RunJobs', json: `{ "Effect": "Allow", "Action": ["glue:StartJobRun", "glue:UpdateJob"], "Resource": "*" }` },
      { sid: 'NoPass', json: `{ "Effect": "Deny", "Action": "iam:PassRole", "Resource": "*" }` },
      { sid: 'Catalog', json: `{ "Effect": "Allow", "Action": ["glue:GetJob", "glue:GetJobRun"], "Resource": "*" }` },
    ],
    risky: 'RunJobs',
    path: ['etl-scheduler', 'glue:UpdateJob change le script d’un job existant', 'job relancé avec son rôle de service', 'droits de ce rôle Glue privilégié'],
    fixes: [
      'Restreindre UpdateJob aux jobs de l’équipe, via une condition sur le tag de ressource du job',
      'Exiger que le script du job pointe un emplacement S3 signé, via la condition glue:ScriptLocation',
      'Séparer les jobs par rôle de service au périmètre minimal, sans job à rôle large partagé',
      'Journaliser chaque UpdateJob vers un bucket verrouillé, pour repérer les modifications de script',
    ],
    why: 'UpdateJob change le script d’un job Glue existant, qui garde son rôle de service : nul besoin d’iam:PassRole, donc le Deny sur PassRole est un leurre. Relancer le job exécute le nouveau script avec ce rôle. Restreindre les jobs modifiables par tag est la première barrière ; contrôler l’emplacement du script referme la variante par redirection.',
  },
];

// ── Les séries ────────────────────────────────────────────────────────────────

import { defineSeries, type SeriesProfile } from '../lib/series';

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<PathAudit>[] = [
  { id: 'primitives', title: 'Primitives', mix: mix(6, 0, 0), level: 1,
    text: 'Un seul saut. L’instruction à risque donne directement l’élévation — créer une clé, attacher une politique admin, lire un secret d’identifiants. Les voisines sont clairement bénignes.' },
  { id: 'premiers-pas', title: 'Premiers pas', mix: mix(4, 2, 0), level: 1,
    text: 'Surtout des primitives, avec deux enchaînements à deux sauts glissés dans le lot pour habituer l’œil à suivre la chaîne.' },
  { id: 'pivots', title: 'Pivots', mix: mix(0, 6, 0), level: 2,
    text: 'Deux sauts : passer un rôle à un service qu’on contrôle puis l’invoquer, réécrire une ressource puis l’utiliser. Une instruction voisine est toujours défendable.' },
  { id: 'passrole', title: 'La famille PassRole', mix: mix(0, 3, 3), level: 2,
    filter: (a) => (a.tags ?? []).includes('passrole'),
    text: 'Tout tourne autour d’iam:PassRole : Lambda, EC2, Glue, CodeBuild, CloudFormation. On apprend à distinguer le PassRole qui ouvre le chemin de celui qui n’y est pour rien.' },
  { id: 'cas-reels', title: 'Cas réels', level: 3,
    filter: (a) => (a.tags ?? []).includes('real'),
    text: 'Des chemins tirés d’incidents et de recherches publiés : SCARLETEEL, l’escalade CloudFormation, l’override de buildspec, la confiance OIDC trop large.' },
  { id: 'chaines', title: 'Chaînes', mix: mix(0, 1, 5), level: 3,
    text: 'Trois sauts, et une impasse leurre à chaque fois : un joker effrayant ou un PassRole large qui ne mène nulle part, pendant que le vrai chemin passe par un détail.' },
  { id: 'expert', title: 'Expert', mix: mix(0, 0, 6), level: 3,
    text: 'Que du niveau 3. Le « plus visible » n’est jamais le coupable, et le chemin passe par une action qui n’exige pas ce qu’on croit.' },
  { id: 'melee', title: 'Mêlée', mix: mix(2, 2, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. C’est la seule série qu’on ne peut pas réviser.' },
];

/** Les séries, au format commun à tous les jeux (écran de choix partagé). */
export const pathSeries = defineSeries(pathAudits, PROFILES);
