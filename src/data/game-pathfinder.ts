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

export type Statement = { sid: string; json: string };
export type PathAudit = {
  id: string;
  role: string;
  purpose: string;
  statements: Statement[];
  risky: string; // sid
  path: string[];
  fixes: string[];
  why: string;
};

export const pathAudits: PathAudit[] = [
  {
    id: 'passrole',
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
    why: 'PassRole sur * permet de confier à une fonction qu’on crée n’importe quel rôle du compte, y compris un rôle administrateur, puis de l’invoquer pour agir avec ses droits. Les trois autres corrections sont bonnes à prendre et laissent ce chemin ouvert : ce n’est pas la création de la fonction qui élève les droits, c’est le rôle qu’on lui attache.',
  },
  {
    id: 'policy-version',
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
    why: 'Un rôle qui peut publier une nouvelle version de sa propre politique et la rendre active peut s’accorder n’importe quel droit : la ressource est pourtant bien nommée, et c’est ce qui trompe. La boundary serait le bon plafond — elle est ici la deuxième meilleure réponse, pas la première, car le droit n’a aucune raison d’exister.',
  },
  {
    id: 'attach-policy',
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
    id: 'trust',
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
    why: 'Une confiance accordée à la racine du compte ne restreint rien : elle délègue la décision aux politiques d’identité, et il suffit alors d’un principal autorisé à assumer « * ». Les trois autres corrections limitent les dégâts une fois le rôle assumé ; seule la première empêche de l’assumer.',
  },
  {
    id: 'ssm',
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
      'Limiter l’accès S3 au préfixe pdf/ des factures, plutôt qu’à l’ensemble du contenu du compartiment',
      'Exiger aws:SecureTransport sur la file SQS et chiffrer les messages avec une clé KMS dédiée',
    ],
    why: 'Exécuter une commande sur une instance gérée, c’est s’exécuter avec le rôle de cette instance : une API exposée à Internet ne doit jamais porter ce droit, même restreint. La deuxième correction est d’ailleurs séduisante et insuffisante — un tag se modifie, et staging finit par contenir une copie des données de production.',
  },
  {
    id: 'access-key',
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
      'Exécuter la fonction dans le VPC et sans accès Internet sortant, pour couper l’exfiltration',
    ],
    why: 'La ressource « * » d’une seule action suffit : créer une clé d’accès pour un utilisateur, c’est agir en son nom, et rien n’empêche de viser un administrateur. Le contraste est instructif — les deux autres actions IAM sont correctement bornées au chemin des prestataires, ce qui donne à la politique une apparence de rigueur.',
  },
  {
    id: 'update-trust',
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
      'Restreindre chatbot:* aux actions de publication sur le canal d’incident, au lieu du joker actuel',
    ],
    why: 'Modifier le code d’une fonction, c’est exécuter ce qu’on veut avec son rôle d’exécution : la fonction de rapprochement bancaire en a un bien plus large que l’astreinte. Les deuxième et troisième corrections sont bonnes et partielles — l’une contrôle la provenance, l’autre le mécanisme, aucune ne réduit le périmètre.',
  },
  {
    id: 'login-profile',
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
  {
    id: 'state-bucket',
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
      'Séparer les tables de verrou par environnement, pour qu’un plan ne bloque pas les autres pipelines',
    ],
    why: 'Le fichier d’état Terraform contient en clair tout ce que les ressources ont produit : mots de passe générés, clés, chaînes de connexion. Ce n’est pas une action IAM qui élève les droits ici, mais une lecture — et c’est ce qui rend l’audit difficile. La deuxième correction ferme le déclencheur externe sans refermer l’état lui-même.',
  },
  {
    id: 'kms-policy',
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
];
