// Modèle du jeu « Allow or Deny ? » (M19).
//
// Le jeu demande deux choses : prédire la décision d'AWS (Allow / Deny), puis
// nommer l'étape de l'évaluation qui tranche. La difficulté ne vient pas du
// service concerné — elle vient du **nombre de politiques à tenir en tête en
// même temps**, et de ce que l'évaluation fait d'un Allow selon sa provenance.
//
// L'ordre officiel d'évaluation, dans un même compte : un Deny explicite gagne
// toujours ; sinon il faut un Allow qui survive à la chaîne RCP → SCP →
// politique de ressource → politique d'identité → permissions boundary →
// politique de session. Un Allow de politique de ressource peut suffire à lui
// seul pour certains types de principal ; entre deux comptes, il faut un Allow
// de chaque côté. C'est cette logique-là que les niveaux gradent.
//
//   N1 · Une seule politique d'identité décide. La réponse tient à un Deny
//        explicite bien visible, ou à une absence d'Allow (mauvaise action,
//        mauvais préfixe, mauvaise ressource). On apprend la forme : « aucune
//        instruction ne s'applique » vaut « Deny ».
//
//   N2 · Deux ou trois politiques se superposent — SCP, permissions boundary,
//        politique de ressource same-account, politique de session, une
//        condition. Au moins un **leurre** : une politique qui a l'air
//        décisive et ne l'est pas (une SCP qui autorise mais ne décide pas, un
//        Deny conditionnel dont la condition n'est pas remplie). Il faut lire
//        le contexte pour savoir laquelle tranche.
//
//   N3 · Le raisonnement passe par un détail de la logique officielle : accès
//        cross-account (un Allow de chaque côté), RCP, `NotAction`/
//        `NotPrincipal`, condition multi-valeurs sur une clé absente
//        (`ForAllValues`), politique de clé KMS, deputy confus, S3 Block Public
//        Access, régime de propriété des objets. Le « plus sécurisé en
//        apparence » est souvent le piège, et la bonne réponse dépend de la
//        provenance de l'Allow autant que de son existence.

export type Step =
  | 'explicit-deny'
  | 'scp'
  | 'rcp'
  | 'resource'
  | 'identity'
  | 'boundary'
  | 'session'
  | 'bpa'
  | 'ownership';

export const stepNames: Record<Step, string> = {
  'explicit-deny': 'Un Deny explicite',
  scp: 'La SCP de l’organisation',
  rcp: 'La RCP de l’organisation',
  resource: 'La politique de ressource',
  identity: 'La politique d’identité',
  boundary: 'La permissions boundary',
  session: 'La politique de session',
  bpa: 'Le blocage d’accès public S3',
  ownership: 'Le régime de propriété des objets S3',
};

export type Level = 1 | 2 | 3;
export type PolicyDoc = { label: string; json: string };
export type IamCase = {
  id: string;
  level: Level;
  /** Familles thématiques, pour composer des séries par sujet. */
  tags?: string[];
  /** Cas qui ne doivent pas tomber dans la même série (structure jumelle). */
  avoid?: string[];
  request: string;
  context: string;
  policies: PolicyDoc[];
  decision: 'allow' | 'deny';
  step: Step;
  why: string;
};

const FULL_ACCESS_SCP = `{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "*", "Resource": "*" }]
}`;

export const iamCases: IamCase[] = [
  // ── N1 : une politique d'identité, Deny explicite ou absence d'Allow ───────
  {
    id: 'basic-allow',
    level: 1,
    tags: ['s3', 'identity'],
    request: 'Le rôle novafact-pdf-worker appelle s3:GetObject sur arn:aws:s3:::novafact-invoices/pdf/acme/inv_42.pdf',
    context: 'Même compte. Pas de permissions boundary. Le bucket n’a pas de politique.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-invoices/pdf/*"
  }]
}` },
      { label: 'SCP (FullAWSAccess)', json: FULL_ACCESS_SCP },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'Aucun Deny, la SCP autorise tout, et la politique d’identité autorise l’action sur ce préfixe : autorisé. C’est le cas de référence dont tous les autres sont une variation.',
  },
  {
    id: 'wrong-prefix',
    level: 1,
    tags: ['s3', 'identity'],
    avoid: ['basic-allow'],
    request: 'Le rôle novafact-pdf-worker appelle s3:GetObject sur arn:aws:s3:::novafact-invoices/reports/2026-q3.csv',
    context: 'Même compte. SCP FullAWSAccess, pas de boundary, le bucket n’a pas de politique.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-invoices/pdf/*"
  }]
}` },
      { label: 'SCP (FullAWSAccess)', json: FULL_ACCESS_SCP },
    ],
    decision: 'deny',
    step: 'identity',
    why: 'L’Allow ne couvre que le préfixe pdf/, et l’objet demandé est sous reports/. Aucune instruction ne s’applique à la requête : c’est un refus implicite, pas un Deny explicite. En IAM, « rien ne l’autorise » suffit à refuser.',
  },
  {
    id: 'wrong-action',
    level: 1,
    tags: ['s3', 'identity'],
    avoid: ['wrong-prefix'],
    request: 'Le rôle novafact-api appelle s3:PutObject sur arn:aws:s3:::novafact-uploads/tmp/scan.png',
    context: 'Même compte. La politique d’identité concerne le même bucket, mais pas la même action.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::novafact-uploads",
      "arn:aws:s3:::novafact-uploads/*"
    ]
  }]
}` },
    ],
    decision: 'deny',
    step: 'identity',
    why: 'La ressource est la bonne, mais l’action demandée (PutObject) n’est pas dans la liste : seuls la lecture et le listage sont accordés. Une politique d’identité juste sur la ressource et fausse sur l’action refuse tout autant qu’une politique vide.',
  },
  {
    id: 'explicit-deny-narrow',
    level: 1,
    tags: ['identity'],
    request: 'Le rôle ops-runbook appelle ec2:TerminateInstances sur i-0a1b2c3d4e5f',
    context: 'Même compte. SCP FullAWSAccess. La politique d’identité gère EC2.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "ec2:*", "Resource": "*" },
    {
      "Effect": "Deny",
      "Action": "ec2:TerminateInstances",
      "Resource": "*"
    }
  ]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'Le Deny explicite sur TerminateInstances l’emporte sur l’Allow ec2:* de la même politique. L’ordre des instructions ne compte pas et il n’existe pas de règle du plus spécifique : dès qu’un Deny s’applique, l’évaluation s’arrête là.',
  },
  {
    id: 'list-bucket-arn',
    level: 1,
    tags: ['s3', 'identity'],
    request: 'Le rôle novafact-api appelle s3:ListBucket sur arn:aws:s3:::novafact-uploads',
    context: 'Même compte. La politique d’identité couvre à la fois le bucket et ses objets.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::novafact-uploads",
      "arn:aws:s3:::novafact-uploads/*"
    ]
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'ListBucket s’exerce sur le bucket lui-même (arn:…:novafact-uploads), pas sur un objet. La politique nomme les deux ARN, celui du bucket et celui des objets (/*), donc le listage passe. Oublier l’ARN du bucket est l’erreur classique qui casse ListBucket tout en laissant GetObject fonctionner.',
  },
  {
    id: 'unrelated-policy',
    level: 1,
    tags: ['identity'],
    request: 'Le rôle log-shipper appelle sqs:SendMessage sur arn:aws:sqs:eu-west-3:111122223333:pdf-jobs',
    context: 'Même compte. SCP FullAWSAccess, pas de boundary.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
    "Resource": "arn:aws:logs:eu-west-3:111122223333:log-group:/novafact/*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'identity',
    why: 'La seule politique attachée parle de CloudWatch Logs, pas de SQS. Rien n’autorise SendMessage, donc refus implicite. Un rôle ne reçoit que ce qu’une instruction lui accorde explicitement.',
  },
  {
    id: 'allow-secret',
    level: 1,
    tags: ['identity'],
    request: 'Le rôle novafact-api appelle secretsmanager:GetSecretValue sur le secret prod/db/main',
    context: 'Même compte. Le secret n’a pas de politique de ressource restrictive et la clé KMS par défaut délègue à IAM.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "secretsmanager:GetSecretValue",
    "Resource": "arn:aws:secretsmanager:eu-west-3:111122223333:secret:prod/db/main-*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'Le suffixe -* de l’ARN couvre les six caractères aléatoires que Secrets Manager ajoute au nom : sans lui, l’ARN ne correspondrait jamais au secret réel. Ici il est présent, l’action est accordée, rien ne s’y oppose : autorisé.',
  },
  {
    id: 'deny-condition-tag',
    level: 1,
    tags: ['identity', 'condition'],
    request: 'Le rôle bi-analyst appelle dynamodb:GetItem sur la table invoices-prod',
    context: 'Même compte. La politique d’identité autorise DynamoDB partout, avec une réserve.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "dynamodb:*", "Resource": "*" },
    {
      "Effect": "Deny",
      "Action": "dynamodb:*",
      "Resource": "*",
      "Condition": {
        "StringEquals": { "aws:ResourceTag/env": "prod" }
      }
    }
  ]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'La table porte le tag env=prod, donc la condition du Deny est remplie et le Deny s’applique. Un Deny conditionnel se lit en deux temps : ce qu’il refuse (toute action DynamoDB) et quand (sur les ressources de production). Ici les deux sont réunis.',
  },
  {
    id: 'allow-multiaction',
    level: 1,
    tags: ['identity'],
    request: 'Le rôle novafact-api appelle sqs:SendMessage sur arn:aws:sqs:eu-west-3:111122223333:pdf-jobs',
    context: 'Même compte. SCP FullAWSAccess, pas de boundary.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["sqs:SendMessage", "sqs:GetQueueUrl"],
    "Resource": "arn:aws:sqs:eu-west-3:111122223333:pdf-jobs"
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'La file demandée est nommée exactement dans la ressource, et SendMessage figure dans la liste des actions. Rien ne restreint la requête au-dessus : la politique d’identité tranche, seule.',
  },
  {
    id: 'wrong-account-arn',
    level: 1,
    tags: ['identity'],
    request: 'Le rôle novafact-api appelle sqs:SendMessage sur arn:aws:sqs:eu-west-3:111122223333:pdf-jobs',
    context: 'Même compte (111122223333). La politique d’identité a été copiée depuis un autre environnement.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "sqs:SendMessage",
    "Resource": "arn:aws:sqs:eu-west-3:444455556666:pdf-jobs"
  }]
}` },
    ],
    decision: 'deny',
    step: 'identity',
    why: 'L’ARN autorisé porte le numéro de compte 444455556666, alors que la file appartient au compte 111122223333. L’action et le nom concordent, mais l’ARN complet, non : une instruction ne s’applique que si la ressource correspond entièrement.',
  },
  {
    id: 'condition-ip-ok',
    level: 1,
    tags: ['identity', 'condition'],
    request: 'L’utilisateur IAM ci-runner appelle s3:GetObject sur novafact-artifacts/build/42.zip, depuis 203.0.113.10',
    context: 'Même compte. La politique d’identité autorise la lecture depuis le réseau de l’entreprise.',
    policies: [
      { label: 'Politique d’identité de l’utilisateur', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-artifacts/*",
    "Condition": {
      "IpAddress": { "aws:SourceIp": "203.0.113.0/24" }
    }
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'L’adresse 203.0.113.10 appartient au bloc 203.0.113.0/24 : la condition est remplie, l’Allow s’applique. Un Allow conditionnel n’a rien de restrictif en soi — il accorde, dès lors que la condition est satisfaite.',
  },
  {
    id: 'condition-ip-ko',
    level: 1,
    tags: ['identity', 'condition'],
    avoid: ['condition-ip-ok'],
    request: 'L’utilisateur IAM ci-runner appelle s3:GetObject sur novafact-artifacts/build/42.zip, depuis 198.51.100.7',
    context: 'Même compte. La politique d’identité autorise la lecture depuis le réseau de l’entreprise.',
    policies: [
      { label: 'Politique d’identité de l’utilisateur', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-artifacts/*",
    "Condition": {
      "IpAddress": { "aws:SourceIp": "203.0.113.0/24" }
    }
  }]
}` },
    ],
    decision: 'deny',
    step: 'identity',
    why: 'L’adresse 198.51.100.7 est hors du bloc autorisé : la condition n’est pas remplie, donc l’Allow ne s’applique pas. Il ne reste aucune instruction pour accorder l’action : refus implicite. Ce n’est pas un Deny — c’est un Allow qui rate sa cible.',
  },

  // ── N2 : SCP, boundary, ressource same-account, session, conditions ────────
  {
    id: 'region-scp',
    level: 2,
    tags: ['scp', 'condition'],
    request: 'Le rôle platform-admin appelle ec2:RunInstances dans la région us-east-1',
    context: 'Le rôle a AdministratorAccess. L’organisation applique une SCP de restriction de régions.',
    policies: [
      { label: 'Politique d’identité (AdministratorAccess)', json: `{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "*", "Resource": "*" }]
}` },
      { label: 'SCP « régions autorisées »', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "NotAction": ["iam:*", "sts:*", "organizations:*", "support:*"],
    "Resource": "*",
    "Condition": {
      "StringNotEquals": { "aws:RequestedRegion": ["eu-west-3", "eu-west-1"] }
    }
  }]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'La SCP contient un Deny explicite pour toute action hors des régions listées. Un Deny explicite l’emporte sur tout, même AdministratorAccess. Le NotAction n’exempte que IAM, STS et deux services globaux — EC2 n’en fait pas partie.',
  },
  {
    id: 'boundary',
    level: 2,
    tags: ['boundary'],
    request: 'Le rôle dev-sandbox appelle dynamodb:GetItem sur la table invoices',
    context: 'Même compte. La SCP est FullAWSAccess.',
    policies: [
      { label: 'Politique d’identité', json: `{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "dynamodb:*", "Resource": "*" }]
}` },
      { label: 'Permissions boundary', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:*", "logs:*", "cloudwatch:*"],
    "Resource": "*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'boundary',
    why: 'Les permissions effectives sont l’intersection de la politique d’identité et de la boundary. DynamoDB n’est pas dans la boundary : celle-ci ne l’autorise pas, ce qui vaut refus implicite. La politique d’identité a beau ouvrir dynamodb:*, elle ne peut pas dépasser le plafond.',
  },
  {
    id: 'boundary-wide-enough',
    level: 2,
    tags: ['boundary'],
    avoid: ['boundary'],
    request: 'Le rôle dev-pdf-worker appelle sqs:SendMessage sur arn:aws:sqs:eu-west-3:111122223333:pdf-jobs',
    context: 'Le rôle a été créé par un développeur, avec la permissions boundary imposée par l’organisation.',
    policies: [
      { label: 'Permissions boundary', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:*", "sqs:*", "logs:*"],
    "Resource": "*"
  }]
}` },
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "sqs:SendMessage",
    "Resource": "arn:aws:sqs:eu-west-3:111122223333:pdf-jobs"
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'La boundary n’accorde jamais rien : elle plafonne. Ici elle couvre sqs:*, donc elle laisse passer, et c’est la politique d’identité qui décide. Une boundary large se remarque à peine — c’est quand elle est plus étroite que l’identité que le refus surprend.',
  },
  {
    id: 'secure-transport',
    level: 2,
    tags: ['s3', 'condition'],
    request: 'Le rôle novafact-pdf-worker appelle s3:GetObject sur novafact-invoices via une requête HTTP non chiffrée',
    context: 'Même compte. La politique d’identité autorise s3:GetObject sur le bucket.',
    policies: [
      { label: 'Politique du bucket (extrait)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyInsecureTransport",
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": ["arn:aws:s3:::novafact-invoices", "arn:aws:s3:::novafact-invoices/*"],
    "Condition": { "Bool": { "aws:SecureTransport": "false" } }
  }]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'Le Deny du bucket s’applique à tout principal quand la requête n’utilise pas TLS. Le Deny explicite gagne sur l’Allow de la politique d’identité. C’est la ceinture de sécurité classique d’un bucket : elle refuse le trafic en clair sans lister qui que ce soit.',
  },
  {
    id: 'kms-viaservice',
    level: 2,
    tags: ['kms', 'condition'],
    request: 'Le rôle novafact-pdf-worker appelle kms:Decrypt directement depuis l’AWS CLI',
    context: 'Même compte. La politique de clé délègue l’accès à IAM (instruction « Enable IAM User Permissions » par défaut).',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "kms:Decrypt",
    "Resource": "arn:aws:kms:eu-west-3:111122223333:key/0f1e2d3c-invoices",
    "Condition": {
      "StringEquals": { "kms:ViaService": "s3.eu-west-3.amazonaws.com" }
    }
  }]
}` },
    ],
    decision: 'deny',
    step: 'identity',
    why: 'La seule autorisation est conditionnée à un appel passant par S3. Un appel direct depuis la CLI ne remplit pas la condition : aucune instruction ne s’applique, refus implicite. La clé kms:ViaService est faite pour ça — restreindre le déchiffrement au service qui doit l’initier.',
  },
  {
    id: 'scp-allowlist',
    level: 2,
    tags: ['scp'],
    request: 'Le rôle app-backend appelle lambda:InvokeFunction',
    context: 'La politique d’identité autorise lambda:InvokeFunction. L’organisation a remplacé FullAWSAccess par une SCP en liste blanche.',
    policies: [
      { label: 'SCP attachée au compte (seule SCP)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:*", "dynamodb:*", "sqs:*", "logs:*", "kms:*"],
    "Resource": "*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'scp',
    why: 'Une SCP n’accorde rien, elle fixe un plafond. Lambda n’est pas dans la liste blanche : l’action est hors du périmètre autorisé par l’organisation, donc refusée pour tous les principaux du compte, quelle que soit leur politique d’identité.',
  },
  {
    id: 'scp-region-ok',
    level: 2,
    tags: ['scp', 's3', 'condition'],
    avoid: ['region-scp'],
    request: 'Le rôle novafact-api appelle s3:GetObject sur arn:aws:s3:::novafact-invoices/pdf/acme/inv_88.pdf, depuis eu-west-3',
    context: 'L’organisation refuse tout ce qui sort des régions européennes. Pas de permissions boundary, pas de politique de ressource.',
    policies: [
      { label: 'SCP de l’unité d’organisation', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "NotAction": ["iam:*", "sts:*", "cloudfront:*"],
    "Resource": "*",
    "Condition": { "StringNotLike": { "aws:RequestedRegion": "eu-*" } }
  }]
}` },
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-invoices/*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'Le Deny de la SCP porte une condition, et eu-west-3 satisfait le motif eu-* : la condition n’est pas remplie, donc le Deny ne s’applique pas. Il ne reste que la politique d’identité, qui autorise. Un Deny conditionnel se lit toujours en deux temps : ce qu’il refuse, et quand.',
  },
  {
    id: 'session',
    level: 2,
    tags: ['session'],
    request: 'Le rôle support-readonly, assumé avec une politique de session, appelle s3:PutObject sur novafact-support/tickets/123.txt',
    context: 'La politique d’identité du rôle autorise s3:GetObject et s3:PutObject sur novafact-support/*.',
    policies: [
      { label: 'Politique de session passée à AssumeRole', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-support/*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'session',
    why: 'Les permissions de la session sont l’intersection de la politique du rôle et de la politique de session. PutObject n’est pas dans la politique de session : celle-ci ne peut que retrancher, jamais ajouter, donc l’action tombe. Le rôle l’autorise pourtant — la session l’a rognée.',
  },
  {
    id: 'session-allows',
    level: 2,
    tags: ['session'],
    avoid: ['session'],
    request: 'Le rôle ci-deployer, assumé avec une politique de session, appelle lambda:UpdateFunctionCode sur function:pdf-render',
    context: 'La politique d’identité du rôle autorise lambda:* sur les fonctions pdf-*. Pas de boundary, pas de SCP restrictive.',
    policies: [
      { label: 'Politique de session passée à AssumeRole', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["lambda:UpdateFunctionCode", "lambda:PublishVersion"],
    "Resource": "arn:aws:lambda:eu-west-3:111122223333:function:pdf-*"
  }]
}` },
      { label: 'SCP (FullAWSAccess)', json: FULL_ACCESS_SCP },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'La session vaut l’intersection de la politique du rôle et de celle passée à AssumeRole : l’action figure dans les deux, donc elle passe. La politique de session ne peut qu’enlever — si elle avait mentionné une action absente du rôle, cela n’aurait rien ajouté.',
  },
  {
    id: 'resource-same-account',
    level: 2,
    tags: ['s3', 'resource'],
    request: 'L’utilisateur IAM ci-reporting appelle s3:GetObject sur arn:aws:s3:::novafact-reports/2026/q3.csv',
    context: 'Même compte. L’utilisateur n’a aucune politique d’identité. Pas de boundary. SCP FullAWSAccess.',
    policies: [
      { label: 'Politique du bucket novafact-reports', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:user/ci-reporting" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-reports/*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'resource',
    why: 'Dans un même compte, une politique de ressource qui nomme directement l’utilisateur IAM suffit à accorder l’accès, même sans politique d’identité : un Allow d’un seul côté suffit pour S3. C’est pourquoi les politiques de ressource se relisent avec autant de soin que les politiques d’identité.',
  },
  {
    id: 'identity-deny',
    level: 2,
    tags: ['s3', 'identity'],
    avoid: ['explicit-deny-narrow'],
    request: 'Le rôle data-analyst appelle s3:GetObject sur arn:aws:s3:::novafact-exports/payroll/2026-02.csv',
    context: 'Même compte. La SCP autorise tout. Le compartiment n’a pas de politique.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::novafact-exports", "arn:aws:s3:::novafact-exports/*"]
    },
    {
      "Effect": "Deny",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::novafact-exports/payroll/*"
    }
  ]
}` },
      { label: 'SCP (FullAWSAccess)', json: FULL_ACCESS_SCP },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'Un Deny explicite l’emporte sur tout Allow, y compris dans la même politique et même si l’Allow est plus précis : il n’y a pas de règle du plus spécifique en IAM. L’ordre des instructions ne compte pas davantage — l’évaluation cherche un Deny avant toute chose.',
  },
  {
    id: 'kms-key-policy',
    level: 2,
    tags: ['kms', 'resource'],
    request: 'Le rôle reporting-worker appelle kms:Decrypt sur arn:aws:kms:eu-west-3:111122223333:key/8f1c-…',
    context: 'Même compte. La SCP autorise tout, et le rôle a bien kms:Decrypt dans sa politique d’identité.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["kms:Decrypt", "kms:DescribeKey"],
    "Resource": "*"
  }]
}` },
      { label: 'Politique de la clé', json: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:root" },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::111122223333:role/billing-worker" },
      "Action": "kms:Decrypt",
      "Resource": "*"
    }
  ]
}` },
    ],
    decision: 'allow',
    step: 'resource',
    why: 'KMS est le service où la politique de ressource est obligatoire : sans elle, aucune politique d’identité ne suffit. Ici la première instruction délègue au compte — c’est le « root » du compte, pas l’utilisateur root — ce qui rend la politique d’identité opérante. Sans cette ligne, le nom du rôle aurait manqué.',
  },
  {
    id: 'scp-permits-not-decides',
    level: 2,
    tags: ['scp', 'identity'],
    request: 'Le rôle novafact-api appelle dynamodb:PutItem sur la table invoices',
    context: 'L’organisation applique une SCP en liste blanche qui inclut DynamoDB. Pas de boundary.',
    policies: [
      { label: 'SCP en liste blanche', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:*", "s3:*", "logs:*"],
    "Resource": "*"
  }]
}` },
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
    "Resource": "arn:aws:dynamodb:eu-west-3:111122223333:table/invoices"
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'La SCP autorise DynamoDB, mais une SCP n’accorde jamais l’accès — elle ne fait que ne pas le refuser. C’est la politique d’identité qui accorde concrètement PutItem sur la table. Confondre « la SCP laisse passer » et « la SCP décide » est le piège : la SCP est une condition nécessaire, pas la cause de l’Allow.',
  },
  {
    id: 'mfa-required',
    level: 2,
    tags: ['identity', 'condition'],
    request: 'L’utilisateur IAM admin-oncall appelle iam:DeleteUser sans authentification multifacteur active dans la session',
    context: 'Même compte. La politique impose la MFA pour les actions sensibles.',
    policies: [
      { label: 'Politique d’identité de l’utilisateur', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "iam:*",
    "Resource": "*",
    "Condition": {
      "Bool": { "aws:MultiFactorAuthPresent": "true" }
    }
  }]
}` },
    ],
    decision: 'deny',
    step: 'identity',
    why: 'L’unique Allow est conditionné à la présence de MFA dans la session. La requête n’en a pas : la condition échoue, l’Allow ne s’applique pas, et rien d’autre n’autorise l’action. Ce n’est pas un Deny — c’est un Allow qui n’a pas ses conditions.',
  },
  {
    id: 'capitalone-broad',
    level: 2,
    tags: ['s3', 'identity', 'real'],
    request: 'Le rôle waf-instance-role, attaché à une instance EC2, appelle s3:ListBucket puis s3:GetObject sur des centaines de compartiments',
    context: 'Même compte. Le rôle de l’instance a reçu un accès S3 très large « pour simplifier ». Des identifiants temporaires ont été lus via l’IMDS.',
    policies: [
      { label: 'Politique d’identité du rôle d’instance', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:ListAllMyBuckets", "s3:ListBucket", "s3:GetObject"],
    "Resource": "*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'AWS applique la politique telle qu’elle est écrite : un Resource "*" autorise la lecture de tous les compartiments. Rien ne refuse la requête, donc elle passe — c’est précisément le scénario de la brèche Capital One (2019), où des identifiants d’un rôle d’instance surdimensionné, obtenus par SSRF sur l’IMDS, ont permis d’exfiltrer plus de 700 buckets. Le moindre privilège aurait borné la ressource ; l’évaluation IAM, elle, ne juge pas la prudence.',
  },
  {
    id: 'boundary-explicit-deny-inside',
    level: 2,
    tags: ['boundary'],
    request: 'Le rôle dev-tools appelle s3:GetObject sur arn:aws:s3:::novafact-secrets/keys.json',
    context: 'Même compte. La politique d’identité autorise s3:* partout. La boundary autorise S3, mais avec une réserve.',
    policies: [
      { label: 'Politique d’identité', json: `{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "s3:*", "Resource": "*" }]
}` },
      { label: 'Permissions boundary', json: `{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:*", "Resource": "*" },
    {
      "Effect": "Deny",
      "Action": "s3:*",
      "Resource": "arn:aws:s3:::novafact-secrets/*"
    }
  ]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'Une permissions boundary ne fait pas que plafonner : elle peut aussi contenir un Deny explicite, qui compte comme n’importe quel autre Deny et l’emporte sur tout Allow. Ici le Deny sur novafact-secrets/* dans la boundary refuse l’accès, malgré le s3:* de la politique d’identité.',
  },

  // ── N3 : cross-account, RCP, NotAction/NotPrincipal, multi-valeurs, KMS,
  //         deputy confus, S3 BPA, propriété des objets ──────────────────────
  {
    id: 'cross-account',
    level: 3,
    tags: ['cross-account', 's3', 'resource'],
    request: 'Le rôle analytics du compte 444455556666 appelle s3:GetObject sur arn:aws:s3:::novafact-invoices/pdf/acme/inv_42.pdf (compte 111122223333)',
    context: 'Accès inter-comptes. SCP FullAWSAccess des deux côtés.',
    policies: [
      { label: 'Politique d’identité du rôle analytics (compte 444455556666)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-invoices/*"
  }]
}` },
      { label: 'Politique du bucket novafact-invoices', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:role/novafact-pdf-worker" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-invoices/pdf/*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'resource',
    why: 'En inter-comptes, il faut deux Allow : la politique d’identité côté appelant et la politique de ressource côté propriétaire. Le bucket n’accorde l’accès qu’au rôle novafact-pdf-worker, pas au rôle analytics du compte 444455556666 : côté propriétaire, rien ne l’autorise, donc refus.',
  },
  {
    id: 'bucket-policy-grant',
    level: 3,
    tags: ['cross-account', 's3', 'resource'],
    avoid: ['cross-account'],
    request: 'Le rôle partner-ingest du compte 444455556666 appelle s3:GetObject sur arn:aws:s3:::novafact-exports/globex/2026-03.csv',
    context: 'Accès entre comptes. Le compte 444455556666 n’a ni SCP restrictive ni permissions boundary sur ce rôle.',
    policies: [
      { label: 'Politique d’identité du rôle (compte 444455556666)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-exports/*"
  }]
}` },
      { label: 'Politique du compartiment (compte 111122223333)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::444455556666:role/partner-ingest" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-exports/globex/*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'resource',
    why: 'Entre deux comptes, il faut un Allow des deux côtés : la politique d’identité dans le compte du demandeur, la politique de ressource dans celui du propriétaire. Les deux sont là, et le préfixe globex/ couvre l’objet visé. C’est la seule configuration où un seul Allow ne suffirait pas.',
  },
  {
    id: 'rcp',
    level: 3,
    tags: ['cross-account', 'rcp', 's3'],
    request: 'Un rôle d’un compte partenaire, hors de l’organisation, appelle s3:GetObject sur novafact-exports',
    context: 'La politique du bucket accorde l’accès au compte partenaire. L’organisation Novafact applique une RCP de périmètre de données.',
    policies: [
      { label: 'Politique du bucket novafact-exports', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::777788889999:root" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-exports/*"
  }]
}` },
      { label: 'RCP « périmètre de données »', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": "*",
    "Condition": {
      "StringNotEqualsIfExists": { "aws:PrincipalOrgID": "o-novafact01" },
      "BoolIfExists": { "aws:PrincipalIsAWSService": "false" }
    }
  }]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'Une RCP limite ce que les ressources de l’organisation acceptent, quelle que soit leur politique. Le principal n’appartient pas à l’organisation : la condition du Deny est remplie, et ce Deny explicite s’applique avant même la politique du bucket. Un Deny gagne toujours, d’où qu’il vienne.',
  },
  {
    id: 'rcp-allow-org',
    level: 3,
    tags: ['cross-account', 'rcp', 's3', 'resource'],
    avoid: ['rcp'],
    request: 'Le rôle analytics du compte 444455556666, membre de l’organisation, appelle s3:GetObject sur novafact-exports/globex/2026-03.csv',
    context: 'Les deux comptes appartiennent à l’organisation o-novafact01. Une RCP de périmètre est en place, la politique du bucket accorde l’accès à ce rôle.',
    policies: [
      { label: 'RCP « périmètre de données »', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": "*",
    "Condition": {
      "StringNotEqualsIfExists": { "aws:PrincipalOrgID": "o-novafact01" }
    }
  }]
}` },
      { label: 'Politique du bucket (compte 111122223333)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::444455556666:role/analytics" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-exports/globex/*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'resource',
    why: 'Le rôle appartient bien à l’organisation, donc la condition du Deny de la RCP (StringNotEquals sur l’OrgID) n’est pas remplie : le Deny ne s’applique pas. La RCP contient toujours un Allow implicite (RCPFullAWSAccess, inamovible), donc l’évaluation se poursuit jusqu’à la politique du bucket, qui accorde l’accès. La RCP filtre l’extérieur, elle ne gêne pas l’intérieur.',
  },
  {
    id: 'notaction-allow',
    level: 3,
    tags: ['identity'],
    request: 'Le rôle break-glass appelle ec2:RunInstances',
    context: 'Même compte. Le rôle a une politique d’identité écrite « à l’envers », avec NotAction.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "NotAction": ["iam:*", "organizations:*", "account:*"],
    "Resource": "*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'Un Allow avec NotAction autorise tout sauf les actions listées : c’est l’inverse d’une liste blanche. ec2:RunInstances n’est pas dans le NotAction, donc l’instruction l’autorise. NotAction dans un Allow est une porte ouverte à retardement — on croit restreindre en énumérant l’interdit, on accorde tout le reste, y compris les services créés demain.',
  },
  {
    id: 'notprincipal-boundary',
    level: 3,
    tags: ['resource', 'boundary', 's3'],
    request: 'Le rôle novafact-pdf-worker (muni d’une permissions boundary) appelle s3:GetObject sur novafact-locked, réservé à un seul rôle',
    context: 'Même compte. Le bucket veut n’autoriser que le rôle admin-audit et refuser tous les autres via NotPrincipal.',
    policies: [
      { label: 'Politique du bucket novafact-locked', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "NotPrincipal": {
      "AWS": "arn:aws:iam::111122223333:role/admin-audit"
    },
    "Action": "s3:*",
    "Resource": "arn:aws:s3:::novafact-locked/*"
  }]
}` },
      { label: 'Politique d’identité du rôle (Allow S3)', json: `{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "s3:*", "Resource": "*" }]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'Un Deny avec NotPrincipal refuse tout le monde sauf le principal listé — mais dès qu’une permissions boundary est attachée au demandeur, ce Deny le frappe systématiquement, quelle que soit la valeur du NotPrincipal (comportement documenté par AWS). Le rôle perd l’accès qu’il aurait dû garder. AWS recommande pour cette raison une condition ArnNotEquals sur aws:PrincipalArn plutôt que NotPrincipal.',
  },
  {
    id: 'forallvalues-absent',
    level: 3,
    tags: ['identity', 'condition', 's3'],
    request: 'Le rôle ci-uploader appelle s3:PutObject sur novafact-artifacts/build.zip, sans joindre aucun tag d’objet',
    context: 'Même compte. La politique veut n’autoriser que des objets tagués avec certaines clés, mais oublie une vérification.',
    policies: [
      { label: 'Politique d’identité du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::novafact-artifacts/*",
    "Condition": {
      "ForAllValues:StringEquals": {
        "aws:TagKeys": ["env", "team", "cost-center"]
      }
    }
  }]
}` },
    ],
    decision: 'allow',
    step: 'identity',
    why: 'ForAllValues renvoie « vrai » quand chaque valeur présente est dans la liste — mais aussi, et c’est le piège, quand la requête ne contient aucune valeur pour la clé. L’objet est déposé sans tag, donc aws:TagKeys est absent, la condition est satisfaite « à vide », et l’Allow s’applique. AWS recommande d’ajouter un opérateur Null à false pour exiger la présence de la clé ; sans lui, la condition est plus permissive qu’elle n’en a l’air.',
  },
  {
    id: 'confused-deputy',
    level: 3,
    tags: ['cross-account', 'resource', 's3', 'condition'],
    request: 'CloudTrail, configuré depuis le compte tiers 999988887777, tente d’écrire des journaux dans le bucket novafact-trail (compte 111122223333) via s3:PutObject',
    context: 'Le bucket accorde l’écriture au principal de service cloudtrail.amazonaws.com, avec une garde.',
    policies: [
      { label: 'Politique du bucket novafact-trail', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "cloudtrail.amazonaws.com" },
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::novafact-trail/AWSLogs/111122223333/*",
    "Condition": {
      "StringEquals": { "aws:SourceAccount": "111122223333" }
    }
  }]
}` },
    ],
    decision: 'deny',
    step: 'resource',
    why: 'Le principal est un service (cloudtrail.amazonaws.com), qui agit ici pour le compte du tiers 999988887777. La condition aws:SourceAccount exige 111122223333 : elle échoue, l’Allow ne s’applique pas, aucune autre instruction n’accorde l’écriture, donc refus. C’est exactement la parade au « deputy confus » — sans cette condition, un tiers pourrait faire écrire CloudTrail dans un bucket dont il connaît seulement le nom.',
  },
  {
    id: 'appsync-trust',
    level: 3,
    tags: ['cross-account', 'resource', 'real'],
    request: 'Le service AppSync, sollicité depuis une configuration d’un autre compte, appelle sts:AssumeRole sur le rôle novafact-appsync-datasource',
    context: 'La politique de confiance du rôle accorde l’assomption au principal de service appsync.amazonaws.com, sans condition de provenance.',
    policies: [
      { label: 'Politique de confiance du rôle', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "appsync.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}` },
    ],
    decision: 'allow',
    step: 'resource',
    why: 'La confiance autorise le principal de service, sans regarder pour quel compte il agit : la demande passe. C’est le schéma du « deputy confus » entre services — Datadog Security Labs a montré en 2022 qu’une faille de validation d’AppSync permettait justement d’assumer des rôles dans d’autres comptes. La parade est une condition aws:SourceAccount ou aws:SourceArn dans la confiance, absente ici.',
  },
  {
    id: 'kms-crossaccount-deny',
    level: 3,
    tags: ['cross-account', 'kms', 'resource'],
    request: 'Le rôle etl-worker du compte 444455556666 appelle kms:Decrypt sur une clé du compte 111122223333',
    context: 'Accès inter-comptes. La politique d’identité du rôle autorise kms:Decrypt sur la clé. La clé délègue à son propre compte.',
    policies: [
      { label: 'Politique d’identité du rôle (compte 444455556666)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "kms:Decrypt",
    "Resource": "arn:aws:kms:eu-west-3:111122223333:key/backups"
  }]
}` },
      { label: 'Politique de la clé (compte 111122223333)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:root" },
    "Action": "kms:*",
    "Resource": "*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'resource',
    why: 'Pour KMS, la politique de la clé doit explicitement autoriser le principal — c’est une exception à la règle « un Allow d’un seul côté suffit ». La clé ne délègue qu’à son propre compte (111122223333) ; le compte externe n’y figure pas. La politique d’identité côté appelant a beau accorder Decrypt, la clé ne l’autorise pas : refus.',
  },
  {
    id: 'resource-role-session',
    level: 3,
    tags: ['resource', 'boundary', 's3'],
    request: 'La session assumée data-loader/report-2026 (rôle data-loader) appelle s3:GetObject sur novafact-shared/report.csv',
    context: 'Même compte. Le rôle data-loader a une permissions boundary qui n’inclut pas S3. Le bucket nomme la session assumée.',
    policies: [
      { label: 'Politique du bucket novafact-shared', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:sts::111122223333:assumed-role/data-loader/report-2026"
    },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::novafact-shared/*"
  }]
}` },
      { label: 'Permissions boundary du rôle (sans S3)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:*", "logs:*"],
    "Resource": "*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'resource',
    why: 'Quand une politique de ressource accorde l’accès directement à l’ARN d’une session assumée (assumed-role/…), la permission va à la session : un refus implicite dans une boundary ou une politique d’identité ne la limite pas. La boundary sans S3 ne bloque donc rien. Ce serait différent si le bucket avait nommé l’ARN du rôle plutôt que celui de la session.',
  },
  {
    id: 'resource-user-boundary',
    level: 3,
    tags: ['resource', 'boundary'],
    avoid: ['resource-role-session'],
    request: 'L’utilisateur IAM svc-backup appelle secretsmanager:GetSecretValue sur le secret prod/db, alors que sa boundary ne couvre pas Secrets Manager',
    context: 'Même compte. La boundary de l’utilisateur autorise S3 et CloudWatch seulement. Le secret nomme l’utilisateur.',
    policies: [
      { label: 'Politique de ressource du secret', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:user/svc-backup" },
    "Action": "secretsmanager:GetSecretValue",
    "Resource": "*"
  }]
}` },
      { label: 'Permissions boundary de l’utilisateur', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:*", "cloudwatch:*"],
    "Resource": "*"
  }]
}` },
    ],
    decision: 'allow',
    step: 'resource',
    why: 'Une politique de ressource qui accorde l’accès directement à l’ARN d’un utilisateur IAM n’est pas limitée par un refus implicite dans sa politique d’identité ni dans sa permissions boundary. La boundary sans Secrets Manager ne l’empêche donc pas : l’Allow de la ressource suffit. Seul un Deny explicite — pas une simple absence — aurait bloqué.',
  },
  {
    id: 's3-bpa-restrict',
    level: 3,
    tags: ['cross-account', 's3', 'bpa'],
    request: 'Le rôle partner-read du compte 444455556666 appelle s3:GetObject sur novafact-exports/shared/data.csv (compte 111122223333)',
    context: 'Le bucket a RestrictPublicBuckets activé. Sa politique mêle un accès nominatif au compte partenaire et une instruction publique laissée par erreur.',
    policies: [
      { label: 'Politique du bucket novafact-exports', json: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Partner",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::444455556666:root" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::novafact-exports/shared/*"
    },
    {
      "Sid": "OublieePublique",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::novafact-exports/public/*"
    }
  ]
}` },
    ],
    decision: 'deny',
    step: 'bpa',
    why: 'Le blocage d’accès public s’évalue avant les politiques. L’instruction « OubliéePublique » (Principal "*", sans condition qui fixe la provenance) rend toute la politique « publique » au sens de S3. Or RestrictPublicBuckets, dès qu’une politique est publique, coupe tout accès cross-account — même l’accès nominatif du partenaire, pourtant non public en soi. Retirer l’instruction publique redonnerait l’accès au partenaire.',
  },
  {
    id: 's3-object-ownership',
    level: 3,
    tags: ['cross-account', 's3', 'ownership'],
    request: 'Le rôle uploader du compte 444455556666 avait déposé un objet avec une ACL bucket-owner-read ; il appelle s3:GetObject dessus',
    context: 'Le bucket novafact-ingest a le régime « Bucket owner enforced » (ACL désactivées). La politique du bucket n’accorde rien au compte externe.',
    policies: [
      { label: 'Régime de propriété du bucket', json: `{
  "ObjectOwnership": "BucketOwnerEnforced",
  "Commentaire": "Les ACL sont désactivées : elles ne sont plus prises en compte."
}` },
      { label: 'Politique du bucket novafact-ingest', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:role/novafact-api" },
    "Action": "s3:*",
    "Resource": "arn:aws:s3:::novafact-ingest/*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'ownership',
    why: 'Avec « Bucket owner enforced », S3 ignore toutes les ACL d’objet et de bucket : l’accès ne peut plus venir que d’une politique. Or la politique du bucket n’accorde rien au compte 444455556666 — elle ne nomme que novafact-api. L’ACL sur laquelle comptait l’uploader ne vaut plus rien : refus. Désactiver les ACL est recommandé, à condition de reporter les accès légitimes dans les politiques.',
  },
  {
    id: 'assume-same-direct',
    level: 3,
    tags: ['resource'],
    request: 'Le rôle ci-runner appelle sts:AssumeRole sur le rôle deploy-prod, dans le même compte, sans droit sts:AssumeRole dans sa politique d’identité',
    context: 'Même compte. La politique de confiance de deploy-prod nomme directement le rôle ci-runner.',
    policies: [
      { label: 'Politique de confiance de deploy-prod', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:role/ci-runner" },
    "Action": "sts:AssumeRole"
  }]
}` },
    ],
    decision: 'allow',
    step: 'resource',
    why: 'Dans un même compte, quand la politique de confiance nomme directement l’ARN du principal, celui-ci n’a pas besoin d’un sts:AssumeRole dans sa propre politique d’identité : la confiance suffit. Ce serait l’inverse si la confiance visait la racine du compte (…:root) ou utilisait aws:PrincipalArn — il faudrait alors le droit côté identité.',
  },
  {
    id: 'assume-root-needs-identity',
    level: 3,
    tags: ['resource', 'identity'],
    avoid: ['assume-same-direct'],
    request: 'Le rôle ci-runner appelle sts:AssumeRole sur le rôle deploy-prod, même compte, sans sts:AssumeRole dans sa politique d’identité',
    context: 'Même compte. La confiance de deploy-prod fait confiance à tout le compte via la racine.',
    policies: [
      { label: 'Politique de confiance de deploy-prod', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::111122223333:root" },
    "Action": "sts:AssumeRole"
  }]
}` },
      { label: 'Politique d’identité de ci-runner (sans STS)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "logs:PutLogEvents"],
    "Resource": "*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'identity',
    why: 'Une confiance qui vise la racine du compte (…:root) ne nomme pas le principal directement : elle délègue la décision aux politiques d’identité. Il faut alors que ci-runner ait sts:AssumeRole dans sa propre politique — ce qui manque ici. La racine « fait confiance à tout le compte », mais chaque principal doit encore recevoir le droit d’assumer.',
  },
  {
    id: 'scp-deny-notaction',
    level: 3,
    tags: ['scp'],
    request: 'Le rôle sec-audit appelle iam:CreateUser dans le compte, sous une SCP de gel des changements',
    context: 'Une SCP fige le compte : tout est refusé sauf la lecture et quelques services.',
    policies: [
      { label: 'Politique d’identité (AdministratorAccess)', json: `{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "*", "Resource": "*" }]
}` },
      { label: 'SCP « gel du compte »', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "NotAction": [
      "iam:Get*", "iam:List*", "iam:GenerateCredentialReport",
      "cloudtrail:LookupEvents", "config:*", "support:*"
    ],
    "Resource": "*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'Le Deny avec NotAction refuse toute action non listée : iam:CreateUser n’est pas dans les exceptions (qui ne couvrent que la lecture IAM et l’audit), donc le Deny le frappe. Un Deny + NotAction est un gel efficace, mais il faut lire la liste comme des exemptions, pas comme des autorisations — la SCP n’accorde rien, elle épargne.',
  },
  {
    id: 'cross-account-scp-caller',
    level: 3,
    tags: ['cross-account', 'scp', 's3'],
    request: 'Le rôle exporter du compte 444455556666 appelle s3:GetObject sur un bucket du compte 111122223333',
    context: 'Le bucket accorde l’accès au rôle. Mais l’organisation du compte appelant applique une SCP qui bloque S3.',
    policies: [
      { label: 'Politique d’identité du rôle (compte 444455556666)', json: `{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "s3:*", "Resource": "*" }]
}` },
      { label: 'SCP du compte appelant (444455556666)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": "s3:*",
    "Resource": "*"
  }]
}` },
      { label: 'Politique du bucket (compte 111122223333)', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::444455556666:role/exporter" },
    "Action": "s3:GetObject",
    "Resource": "*"
  }]
}` },
    ],
    decision: 'deny',
    step: 'explicit-deny',
    why: 'Un accès cross-account exige un Allow des deux côtés — et chaque côté est évalué avec toutes ses politiques. Côté appelant, la SCP du compte 444455556666 pose un Deny explicite sur S3 : l’évaluation de ce compte échoue, donc la requête est refusée avant même de regarder le bucket. Une SCP s’applique au principal, où que soit la ressource.',
  },
  {
    id: 'boundary-scp-identity',
    level: 3,
    tags: ['boundary', 'scp'],
    request: 'Le rôle dev-lambda appelle sns:Publish sur un topic, dans un compte à SCP en liste blanche et boundary',
    context: 'Même compte. Trois politiques se superposent : SCP, boundary et identité. Aucune n’a de Deny explicite.',
    policies: [
      { label: 'SCP en liste blanche', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["sns:*", "lambda:*", "logs:*"],
    "Resource": "*"
  }]
}` },
      { label: 'Permissions boundary', json: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["lambda:*", "logs:*"],
    "Resource": "*"
  }]
}` },
      { label: 'Politique d’identité', json: `{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "sns:Publish", "Resource": "*" }]
}` },
    ],
    decision: 'deny',
    step: 'boundary',
    why: 'Sans Deny explicite, l’action doit être autorisée par les trois politiques à la fois — leur intersection. La SCP autorise SNS, l’identité aussi, mais la boundary ne liste que Lambda et Logs : elle n’autorise pas sns:Publish. Une seule des trois qui n’accorde pas suffit à refuser. C’est la boundary, le maillon le plus étroit, qui tranche.',
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────
//
// La difficulté d'une série ne tient pas au service, mais au nombre de
// politiques à confronter et à la finesse de la règle qui tranche. Les séries
// « mix » ignorent le thème (c'est le but : on ne sait pas d'où viendra la
// décision) ; deux séries thématiques regroupent un même terrain (le cross-
// account, S3) pour travailler une famille de mécanismes.

import { defineSeries, type SeriesProfile } from '../lib/series';

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<IamCase>[] = [
  { id: 'bases', title: 'Les bases', mix: mix(8, 0, 0), level: 1,
    text: 'Une seule politique d’identité tranche. Un Deny visible, ou une action, une ressource, un préfixe qui ne correspond pas. On apprend à lire « rien ne l’autorise » comme un refus.' },
  { id: 'sous-conditions', title: 'Sous conditions', mix: mix(4, 4, 0), level: 1,
    text: 'La moitié des cas ajoutent une SCP, une boundary ou une condition. Il faut repérer laquelle décide vraiment — et laquelle ne fait que laisser passer.' },
  { id: 'garde-fous', title: 'Garde-fous', mix: mix(0, 8, 0), level: 2,
    text: 'Deux ou trois politiques se superposent : SCP, permissions boundary, politique de session, politique de ressource same-account. Chacune peut plafonner sans jamais accorder.' },
  { id: 'le-doute', title: 'Le doute', mix: mix(2, 4, 2), level: 2,
    text: 'Des cas où une politique a l’air décisive et ne l’est pas : un Deny dont la condition n’est pas remplie, une SCP qui autorise sans trancher. Il faut lire le contexte en entier.' },
  { id: 'cross-account', title: 'Entre deux comptes', mix: mix(0, 0, 8), level: 3,
    filter: (c) => (c.tags ?? []).includes('cross-account'),
    text: 'Accès inter-comptes, RCP, deputy confus, politique de clé KMS : un Allow de chaque côté, et l’ordre RCP → SCP → ressource qui décide où ça casse.' },
  { id: 'tout-s3', title: 'Tout S3', mix: mix(2, 3, 3), level: 2,
    filter: (c) => (c.tags ?? []).includes('s3'),
    text: 'Le même service, tous les mécanismes : préfixes, Deny de transport, politique de bucket, blocage d’accès public, propriété des objets. S3 concentre presque toute la logique IAM.' },
  { id: 'audit', title: 'Audit', mix: mix(0, 3, 5), level: 3,
    text: 'Surtout du niveau 3 : NotAction, NotPrincipal, condition multi-valeurs sur une clé absente, session assumée nommée dans une ressource. La provenance de l’Allow compte autant que son existence.' },
  { id: 'expert', title: 'Expert', mix: mix(0, 0, 8), level: 3,
    text: 'Rien ne se devine à la forme. Le « plus sécurisé en apparence » est souvent le piège, et la réponse dépend d’un détail de la logique officielle d’évaluation.' },
  { id: 'melee', title: 'Mêlée', mix: mix(3, 3, 2), level: 2, shuffleEachTime: true,
    text: 'Tous niveaux confondus, recomposée à chaque partie. C’est la seule série qu’on ne peut pas réviser.' },
];

/** Les séries, au format commun à tous les jeux (écran de choix partagé). */
export const iamSeries = defineSeries(iamCases, PROFILES);
