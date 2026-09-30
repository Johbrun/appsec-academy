// Scénarios du jeu « Allow or Deny ? » (M15). Chaque cas suit la logique d'évaluation des politiques AWS :
// deny explicite > SCP/RCP > politique de ressource > politique d'identité > boundary > session.

export type Step =
  | 'explicit-deny'
  | 'scp'
  | 'rcp'
  | 'resource'
  | 'identity'
  | 'boundary'
  | 'session';

export const stepNames: Record<Step, string> = {
  'explicit-deny': 'Un Deny explicite',
  scp: 'La SCP de l’organisation',
  rcp: 'La RCP de l’organisation',
  resource: 'La politique de ressource',
  identity: 'La politique d’identité',
  boundary: 'La permissions boundary',
  session: 'La politique de session',
};

export type PolicyDoc = { label: string; json: string };
export type IamCase = {
  id: string;
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
  {
    id: 'basic-allow',
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
    why: 'Aucun Deny, la SCP autorise tout, et la politique d’identité autorise l’action sur ce préfixe : autorisé.',
  },
  {
    id: 'region-scp',
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
    why: 'La SCP contient un Deny explicite pour toute action hors des régions listées. Un Deny explicite l’emporte sur tout, même AdministratorAccess.',
  },
  {
    id: 'boundary',
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
    why: 'Les permissions effectives sont l’intersection de la politique d’identité et de la boundary. DynamoDB n’est pas dans la boundary : refus implicite.',
  },
  {
    id: 'resource-same-account',
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
    why: 'Dans un même compte, une politique de ressource qui nomme directement l’utilisateur IAM suffit à accorder l’accès, même sans politique d’identité. C’est pourquoi les politiques de ressource se relisent avec autant de soin que les politiques d’identité.',
  },
  {
    id: 'cross-account',
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
    why: 'En inter-comptes, il faut deux autorisations : la politique d’identité côté appelant et la politique de ressource côté propriétaire. Le bucket n’accorde rien au compte 444455556666 : refus.',
  },
  {
    id: 'secure-transport',
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
    why: 'Le Deny du bucket s’applique à tout principal quand la requête n’utilise pas TLS. Le Deny explicite gagne sur l’Allow de la politique d’identité.',
  },
  {
    id: 'rcp',
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
    step: 'rcp',
    why: 'Les RCP limitent ce que les ressources de l’organisation acceptent, quelle que soit leur politique. Le principal n’appartient pas à l’organisation : le Deny de la RCP s’applique, même si la politique du bucket l’autorise.',
  },
  {
    id: 'kms-viaservice',
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
    why: 'La seule autorisation est conditionnée à un appel passant par S3. Un appel direct ne remplit pas la condition : aucune instruction ne s’applique, refus implicite.',
  },
  {
    id: 'scp-allowlist',
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
    why: 'Une SCP n’accorde rien, elle fixe un plafond. Lambda n’est pas dans la liste blanche : l’action est refusée implicitement pour tous les principaux du compte.',
  },
  {
    id: 'session',
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
    why: 'Les permissions de la session sont l’intersection de la politique du rôle et de la politique de session. PutObject n’est pas dans la politique de session : refus.',
  },
  {
    id: 'scp-region-ok',
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
    id: 'bucket-policy-grant',
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
    id: 'identity-deny',
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
    id: 'boundary-wide-enough',
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
    id: 'kms-key-policy',
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
    id: 'session-allows',
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
];
