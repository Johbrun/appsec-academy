// Fichiers du jeu « IaC Misconfig Hunt » (M20) : Terraform (provider AWS)
// surtout, avec un gabarit CloudFormation et un stack CDK en TypeScript.
//
// Le jeu demande de cliquer les lignes mal configurées puis de nommer la
// catégorie de risque. Chaque défaut correspond à un attribut réel du provider
// ou du service. La difficulté vient de ce qui entoure la ligne fautive :
//
//   N1 · Un fichier court, des valeurs qui se lisent seules (0.0.0.0/0,
//        `encrypted = false`, un mot de passe dans le code). Rien d'autre ne
//        ressemble à un défaut. On apprend les attributs qui comptent.
//
//   N2 · Un fichier de taille réelle qui contient déjà de **bons réglages
//        trompeurs** : la politique de clé KMS par défaut (`kms:*` pour le
//        compte), un `Principal` de service borné par `AWS:SourceArn`, une
//        suppression automatique justifiée par le contexte, un joker imposé
//        par l'API. Les signaler coûte, et le défaut est une valeur parmi
//        d'autres, pas une ligne qui crie.
//
//   N3 · Le défaut est une **absence** (un attribut dont la valeur par défaut
//        est dangereuse, une condition qui manque), une condition qui a l'air
//        de protéger et ne protège rien, ou une chaîne de deux ressources dont
//        aucune n'est fautive seule. Il faut raisonner en plusieurs sauts.

import type { AuditCategory, AuditItem } from '../components/LineAudit';
import { defineSeries, type SeriesProfile } from '../lib/series';

export const iacCategories: AuditCategory[] = [
  { id: 1, name: 'Exposition réseau', short: 'Réseau' },
  { id: 2, name: 'Accès public aux données', short: 'Public' },
  { id: 3, name: 'Chiffrement absent ou faible', short: 'Chiffrement' },
  { id: 4, name: 'IAM trop large', short: 'IAM' },
  { id: 5, name: 'Métadonnées d’instance (IMDSv1)', short: 'IMDS' },
  { id: 6, name: 'Secret en clair', short: 'Secret' },
  { id: 7, name: 'Journalisation et traçabilité', short: 'Logs' },
  { id: 8, name: 'Résilience et sauvegarde', short: 'Résilience' },
];

export type IacFile = AuditItem & {
  level: 1 | 2 | 3;
  /** `donnees` : stockage et bases ; `identites` : IAM, politiques de ressource, fédération. */
  tags?: string[];
  avoid?: string[];
};

export const iacFiles: IacFile[] = [
  {
    id: 's3',
    level: 1,
    tags: ['donnees'],
    file: 'infra/storage/invoices.tf',
    intro: 'Le bucket des factures PDF, et un bucket d’export ajouté pour un partenaire.',
    code: `resource "aws_s3_bucket" "invoices" {
  bucket = "novafact-invoices-prod"
}

resource "aws_s3_bucket_versioning" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  versioning_configuration {
    status = "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket                  = aws_s3_bucket.invoices.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "exports" {
  bucket = "novafact-exports-partner"
}

resource "aws_s3_bucket_policy" "exports" {
  bucket = aws_s3_bucket.exports.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "\${aws_s3_bucket.exports.arn}/*"
    }]
  })
}`,
    issues: [
      { match: 'status = "Suspended"', cats: [8], text: 'Sans versioning, un objet supprimé ou écrasé (erreur, rançongiciel) est perdu. Activer le versioning, voire Object Lock pour les factures, soumises à une durée de conservation légale.' },
      { match: 'Principal = "*"', cats: [2, 4], text: 'Tout Internet peut lire les exports. Nommer le compte du partenaire (ou passer par des URL présignées), et garder Block Public Access actif sur ce bucket aussi.' },
    ],
  },
  {
    id: 'network',
    level: 1,
    tags: ['donnees'],
    file: 'infra/network/api.tf',
    intro: 'Le réseau de l’API, sa base Postgres et une instance de maintenance.',
    code: `resource "aws_security_group" "bastion" {
  name   = "bastion"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "main" {
  identifier          = "novafact-prod"
  engine              = "postgres"
  instance_class      = "db.r6g.large"
  publicly_accessible = true
  storage_encrypted   = false
  backup_retention_period = 7
  deletion_protection = true
}

resource "aws_instance" "maintenance" {
  ami           = data.aws_ami.al2023.id
  instance_type = "t3.small"
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "optional"
  }
}`,
    issues: [
      { match: 'cidr_blocks = ["0.0.0.0/0"]', cats: [1], text: 'SSH ouvert à tout Internet. Supprimer le bastion au profit de SSM Session Manager, ou restreindre à des adresses connues.' },
      { match: 'publicly_accessible = true', cats: [1], text: 'La base de production reçoit une adresse publique. Elle doit rester dans des sous-réseaux privés, accessible seulement depuis l’API.' },
      { match: 'storage_encrypted   = false', cats: [3], text: 'Stockage de la base non chiffré : les instantanés et les volumes aussi. Activer storage_encrypted avec une clé KMS gérée par Novafact.' },
      { match: 'http_tokens   = "optional"', cats: [5], text: 'IMDSv1 reste possible : une SSRF sur l’instance peut lire les identifiants de son rôle, le chemin suivi contre Capital One en 2019. Exiger http_tokens = "required" (IMDSv2).' },
    ],
  },
  {
    id: 'iam',
    level: 2,
    tags: ['identites'],
    file: 'infra/iam/app.tf',
    intro: 'Le rôle de l’API et un utilisateur technique pour un ancien script.',
    code: `resource "aws_iam_role" "api" {
  name = "novafact-api"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "*" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "api" {
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "*", Resource = "*" }]
  })
}

resource "aws_iam_role_policy_attachment" "api_logs" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsReadOnlyAccess"
}

resource "aws_iam_user" "legacy_script" {
  name = "legacy-export-script"
}

resource "aws_iam_access_key" "legacy_script" {
  user = aws_iam_user.legacy_script.name
}`,
    issues: [
      { match: 'Principal = { AWS = "*" }', cats: [4], text: 'La politique de confiance accepte n’importe quel principal AWS : n’importe quel compte peut tenter d’assumer ce rôle. Le rôle d’une tâche ECS fait confiance à ecs-tasks.amazonaws.com, avec des conditions sur le compte source.' },
      { match: 'Action = "*", Resource = "*"', cats: [4], text: 'Le rôle de l’API est administrateur du compte. Lister les actions et les ressources nécessaires ; IAM Access Analyzer peut générer une politique à partir de l’activité réelle.' },
      { match: 'resource "aws_iam_access_key"', cats: [6, 4], text: 'Une clé d’accès longue durée créée par Terraform finit en clair dans l’état Terraform. Remplacer l’utilisateur par un rôle (OIDC, rôle d’instance) ; à défaut, ne jamais gérer la clé dans Terraform.' },
    ],
    decoys: [
      { match: 'CloudWatchLogsReadOnlyAccess', text: 'Une politique gérée par AWS, en lecture seule, sur les journaux : c’est borné et lisible. Ce qui rend ce rôle dangereux est la politique en ligne juste au-dessus.' },
    ],
  },
  {
    id: 'app',
    level: 2,
    file: 'infra/app/services.tf',
    intro: 'La fonction de relance des impayés, l’équilibreur de charge public et la piste CloudTrail.',
    code: `resource "aws_lambda_function" "reminders" {
  function_name = "invoice-reminders"
  role          = aws_iam_role.reminders.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = "dist/reminders.zip"
  environment {
    variables = {
      SMTP_HOST     = "smtp.novafact.example"
      SMTP_PASSWORD = "Nf-2026!relances"
    }
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_cloudtrail" "main" {
  name                          = "org-trail"
  s3_bucket_name                = aws_s3_bucket.trail.id
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_logging                = false
}`,
    issues: [
      { match: 'SMTP_PASSWORD', cats: [6], text: 'Mot de passe en clair dans le code, dans l’état Terraform et dans la configuration de la fonction. Le stocker dans Secrets Manager et le lire au démarrage.' },
      { match: 'type             = "forward"', cats: [3, 1], text: 'Le listener HTTP sert l’API en clair au lieu de rediriger vers HTTPS. L’action par défaut doit être une redirection 301 vers le port 443.' },
      { match: 'enable_logging                = false', cats: [7], text: 'La piste existe mais n’enregistre rien : aucune trace des actions sur le compte. Activer la journalisation et la validation d’intégrité des fichiers de logs.' },
    ],
    decoys: [
      { match: 'SMTP_HOST', text: 'Un nom d’hôte n’est pas un secret : il peut vivre dans les variables d’environnement. Seule la ligne suivante pose problème.' },
      { match: 'is_multi_region_trail', text: 'Une piste multi-régions capte aussi l’activité dans les régions que Novafact n’utilise pas, celles qu’un attaquant choisit pour passer inaperçu. Bon réglage.' },
    ],
  },

  // ── N1 ────────────────────────────────────────────────────────────────────
  {
    id: 'pdf-workers',
    level: 1,
    avoid: ['network'],
    file: 'infra/compute/pdf-workers.tf',
    intro: 'Les instances qui génèrent les PDF de factures. Elles lisent une file de travaux et n’acceptent aucune connexion entrante.',
    code: `resource "aws_instance" "pdf_worker" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = "c7g.large"
  subnet_id                   = aws_subnet.public_a.id
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.pdf_worker.name
  user_data                   = <<-EOT
    #!/bin/bash
    echo "DATABASE_URL=postgres://pdf:Pdf-Worker-2026@db.internal:5432/novafact" >> /etc/novafact.env
    systemctl start pdf-worker
  EOT
}

resource "aws_ebs_volume" "pdf_cache" {
  availability_zone = "eu-west-3a"
  size              = 200
  encrypted         = false
}`,
    issues: [
      { match: 'associate_public_ip_address = true', cats: [1], text: 'Un serveur qui n’accepte aucune connexion reçoit quand même une adresse publique, dans un sous-réseau public : il suffit d’une règle de groupe de sécurité trop large pour l’exposer. Sous-réseau privé et passerelle NAT pour sortir.' },
      { match: 'postgres://pdf:', cats: [6], text: 'Les user data ne sont pas un coffre : elles sont lisibles par quiconque a ec2:DescribeInstanceAttribute, et depuis l’instance par le service de métadonnées. Le mot de passe est aussi dans le code et dans l’état Terraform. Le lire au démarrage dans Secrets Manager.' },
      { match: 'encrypted         = false', cats: [3], text: 'Le cache contient des factures rendues. Un volume non chiffré donne des instantanés non chiffrés. encrypted = true, avec une clé KMS, ou mieux le chiffrement EBS par défaut activé sur le compte.' },
    ],
  },
  {
    id: 'opensearch',
    level: 1,
    tags: ['donnees'],
    file: 'infra/search/opensearch.tf',
    intro: 'Le moteur de recherche plein texte sur les factures de tous les tenants. Le domaine n’est pas dans un VPC.',
    code: `resource "aws_opensearch_domain" "invoices" {
  domain_name    = "invoices-search"
  engine_version = "OpenSearch_2.13"

  cluster_config {
    instance_type  = "r6g.large.search"
    instance_count = 3
  }

  encrypt_at_rest { enabled = false }
  node_to_node_encryption { enabled = false }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "*" }
      Action    = "es:*"
      Resource  = "arn:aws:es:eu-west-3:111122223333:domain/invoices-search/*"
    }]
  })
}`,
    issues: [
      { match: 'encrypt_at_rest { enabled = false }', cats: [3], text: 'Index, journaux et instantanés automatiques en clair sur disque. Le chiffrement au repos est aussi un prérequis du contrôle d’accès fin d’OpenSearch.' },
      { match: 'node_to_node_encryption { enabled = false }', cats: [3], text: 'Les nœuds du cluster échangent les documents en clair. HTTPS côté client ne couvre pas ce trajet-là.' },
      { match: 'Principal = { AWS = "*" }', cats: [2, 4], text: 'Un domaine hors VPC a un point de terminaison public ; avec cette politique, tout Internet peut interroger et modifier l’index, sans signature. Nommer le rôle de l’API comme principal, et placer le domaine dans le VPC.' },
    ],
  },
  {
    id: 'cfn-reporting',
    level: 1,
    lang: 'yaml',
    tags: ['donnees'],
    avoid: ['network', 'rds-snapshot'],
    file: 'infra/cloudformation/reporting-db.yaml',
    intro: 'Gabarit CloudFormation de la base de reporting, écrit par l’équipe data avant la migration vers Terraform.',
    code: `AWSTemplateFormatVersion: '2010-09-09'
Description: Base de reporting de Novafact
Resources:
  ReportingDb:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: novafact-reporting
      Engine: postgres
      DBInstanceClass: db.t4g.medium
      AllocatedStorage: '100'
      MasterUsername: reporting
      MasterUserPassword: 'Rep0rting-2026!'
      PubliclyAccessible: true
      StorageEncrypted: true
      BackupRetentionPeriod: 0
      DeletionProtection: true`,
    issues: [
      { match: 'MasterUserPassword', cats: [6], text: 'Le mot de passe est dans le gabarit, donc dans Git et visible dans la console CloudFormation. ManageMasterUserPassword: true le confie à Secrets Manager, qui le fait tourner.' },
      { match: 'PubliclyAccessible: true', cats: [1], text: 'L’instance reçoit un nom DNS qui se résout en adresse publique : il ne reste plus que le groupe de sécurité entre Internet et Postgres.' },
      { match: 'BackupRetentionPeriod: 0', cats: [8], text: 'Zéro désactive les sauvegardes automatiques, et avec elles la restauration à un instant donné. Une erreur de requête ou un rançongiciel, et il ne reste rien.' },
    ],
  },

  // ── N2 ────────────────────────────────────────────────────────────────────
  {
    id: 'cloudfront',
    level: 2,
    tags: ['donnees'],
    file: 'infra/web/cdn.tf',
    intro: 'La distribution CloudFront qui sert l’application web depuis un bucket S3 privé.',
    code: `resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = ["app.novafact.example"]

  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
  }

  default_cache_behavior {
    target_origin_id       = "assets"
    viewer_protocol_policy = "allow-all"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.app.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
      locations        = []
    }
  }
}

resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "\${aws_s3_bucket.assets.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.app.arn } }
    }]
  })
}`,
    issues: [
      { match: 'viewer_protocol_policy = "allow-all"', cats: [3], text: 'Le navigateur peut charger l’application en HTTP : un réseau hostile réécrit le JavaScript au passage, et tout ce que protège HTTPS ensuite est perdu. redirect-to-https.' },
      { match: 'minimum_protocol_version = "TLSv1"', cats: [3], text: 'TLS 1.0 et 1.1 sont dépréciés (RFC 8996). Avec un certificat ACM en SNI, on peut choisir la politique : TLSv1.2_2021 au minimum.' },
    ],
    decoys: [
      { match: 'signing_behavior                  = "always"', text: 'L’Origin Access Control signe toutes les requêtes vers S3 : le bucket peut rester privé et n’accepter que CloudFront. C’est la configuration recommandée.' },
      { match: 'Principal = { Service = "cloudfront.amazonaws.com" }', text: 'Un principal de service seul serait trop large, tous les clients CloudFront partageant ce service. La condition AWS:SourceArn, deux lignes plus bas, le limite à cette distribution-ci.' },
      { match: 'restriction_type = "none"', text: 'Ne pas filtrer par pays n’est pas un défaut de sécurité : c’est un choix commercial, et le blocage géographique se contourne de toute façon.' },
    ],
  },
  {
    id: 'stripe-secret',
    level: 2,
    tags: ['identites'],
    avoid: ['app'],
    file: 'infra/secrets/stripe.tf',
    intro: 'La clé Stripe de production, sa clé de chiffrement KMS et l’accès de l’API au secret.',
    code: `data "aws_caller_identity" "current" {}

resource "aws_kms_key" "secrets" {
  description         = "Secrets applicatifs"
  enable_key_rotation = true
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "Enable IAM User Permissions"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::\${data.aws_caller_identity.current.account_id}:root" }
      Action    = "kms:*"
      Resource  = "*"
    }]
  })
}

resource "aws_secretsmanager_secret" "stripe" {
  name                    = "prod/stripe"
  kms_key_id              = aws_kms_key.secrets.arn
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "stripe" {
  secret_id     = aws_secretsmanager_secret.stripe.id
  secret_string = "sk_live_51NovafactExample000000000000"
}

resource "aws_iam_role_policy" "api_secrets" {
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "kms:Decrypt"]
      Resource = "*"
    }]
  })
}`,
    issues: [
      { match: 'recovery_window_in_days = 0', cats: [8], text: 'Zéro supprime le secret immédiatement, sans période de récupération : un terraform destroy malheureux, et les paiements s’arrêtent sans retour possible. La valeur par défaut, 30 jours, existe pour ça.' },
      { match: 'secret_string = "sk_live', cats: [6], text: 'Le secret est dans le code et dans l’état Terraform, en clair. Depuis Terraform 1.11, secret_string_wo est un argument en écriture seule qui n’est pas conservé dans l’état ; sinon, créer le secret vide et y déposer la valeur hors de Terraform.' },
      { match: 'Resource = "*"', cats: [4], text: 'L’API peut lire tous les secrets du compte et déchiffrer avec toutes les clés, pas seulement la clé Stripe. Resource = l’ARN du secret, et kms:Decrypt borné à la clé.' },
    ],
    decoys: [
      { match: ':root" }', text: 'C’est la déclaration par défaut d’une politique de clé KMS : elle ne donne rien à tout le monde, elle délègue aux politiques IAM du compte. Sans elle, plus personne ne peut administrer la clé.' },
      { match: 'enable_key_rotation = true', text: 'Rotation annuelle automatique du matériau de la clé : bonne pratique, sans effet sur les données déjà chiffrées.' },
      { match: 'kms_key_id              = aws_kms_key.secrets.arn', text: 'Le secret est chiffré avec une clé gérée par Novafact plutôt qu’avec la clé AWS par défaut : on contrôle qui peut déchiffrer.' },
    ],
  },
  {
    id: 'cdk-exports',
    level: 2,
    lang: 'ts',
    tags: ['identites'],
    file: 'infra/cdk/lib/exports-stack.ts',
    intro: 'Stack CDK de la fonction qui génère les exports comptables. Les exports sont régénérables à la demande et expirent au bout de 30 jours ; la fonction lit la table DynamoDB des écritures.',
    code: `import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export class ExportsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'Exports', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(30) }],
    });

    const fn = new lambda.Function(this, 'ExportFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/export'),
      environment: {
        BUCKET: bucket.bucketName,
        SENDGRID_API_KEY: 'SG.nvfct-2026.q1Xs8Lr0PzKw',
      },
    });
    bucket.grantPut(fn);

    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:*'],
      resources: ['*'],
    }));

    fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });
  }
}`,
    issues: [
      { match: "SENDGRID_API_KEY: 'SG.", cats: [6], text: 'La clé est dans le code, puis dans le gabarit CloudFormation synthétisé et dans la configuration de la fonction. Un secret Secrets Manager lu au démarrage, avec secret.grantRead(fn).' },
      { match: "actions: ['dynamodb:*']", cats: [4], text: 'La fonction lit une table ; elle reçoit toutes les actions DynamoDB sur toutes les tables du compte, suppression comprise. table.grantReadData(fn) produit la politique minimale.' },
      { match: 'FunctionUrlAuthType.NONE', cats: [2, 1], text: 'Une URL de fonction sans authentification : n’importe qui sur Internet déclenche un export comptable. FunctionUrlAuthType.AWS_IAM, ou passer par l’API authentifiée.' },
    ],
    decoys: [
      { match: 'BlockPublicAccess.BLOCK_ALL', text: 'Les quatre réglages Block Public Access activés : le bucket ne peut pas devenir public par erreur.' },
      { match: 'enforceSSL: true', text: 'Ajoute à la politique du bucket un refus de toute requête hors TLS (aws:SecureTransport). Bonne pratique.' },
      { match: 'RemovalPolicy.DESTROY', text: 'Détruire le bucket avec le stack est souvent une faute pour des données de référence. Ici, les exports sont régénérables et expirent en 30 jours : c’est un choix cohérent, pas un risque.' },
      { match: 'bucket.grantPut(fn)', text: 'Une méthode grant du CDK génère la politique minimale : écriture seule, sur ce bucket seul. C’est ce qu’il fallait faire aussi pour DynamoDB.' },
    ],
  },

  // ── N3 ────────────────────────────────────────────────────────────────────
  {
    id: 'rds-snapshot',
    level: 3,
    tags: ['donnees'],
    avoid: ['network'],
    file: 'infra/data/reporting.tf',
    intro: 'La base de reporting et l’instantané pris avant la migration v2, que le prestataire d’audit avait demandé à consulter.',
    code: `resource "aws_db_instance" "reporting" {
  identifier                          = "novafact-reporting"
  engine                              = "postgres"
  instance_class                      = "db.r6g.large"
  allocated_storage                   = 200
  username                            = "reporting"
  db_subnet_group_name                = aws_db_subnet_group.private.name
  publicly_accessible                 = false
  manage_master_user_password         = true
  iam_database_authentication_enabled = true
  backup_retention_period             = 14
  deletion_protection                 = true
}

resource "aws_db_snapshot" "before_migration" {
  db_instance_identifier = aws_db_instance.reporting.identifier
  db_snapshot_identifier = "reporting-before-v2"
  shared_accounts        = ["all"]
}`,
    issues: [
      { match: 'resource "aws_db_instance" "reporting"', cats: [3], text: 'storage_encrypted n’est pas déclaré, et sa valeur par défaut est false. C’est aussi ce qui a permis la ligne fautive plus bas : AWS refuse de rendre public un instantané chiffré, mais l’accepte pour un instantané en clair. Le défaut qu’on ne voit pas est la condition de celui qu’on voit.' },
      { match: 'shared_accounts        = ["all"]', cats: [2], text: '« all » rend l’instantané public : n’importe quel compte AWS peut le restaurer et lire toute la base. Mitiga a relevé en 2022 des centaines d’instantanés RDS publics contenant des données personnelles. Partager avec l’identifiant du compte du prestataire, et chiffrer avec une clé KMS partagée.' },
    ],
    decoys: [
      { match: 'publicly_accessible                 = false', text: 'L’instance n’a pas d’adresse publique : c’est correct. Mais un instantané contourne le réseau, il se restaure ailleurs.' },
      { match: 'manage_master_user_password         = true', text: 'Le mot de passe maître est créé et tourné par Secrets Manager, jamais écrit dans le code ni dans l’état. La bonne pratique.' },
      { match: 'iam_database_authentication_enabled = true', text: 'Permet de se connecter avec un jeton IAM de courte durée au lieu d’un mot de passe. Bon réglage.' },
    ],
  },
  {
    id: 'passrole',
    level: 3,
    tags: ['identites'],
    avoid: ['iam'],
    file: 'infra/iam/builder.tf',
    intro: 'Le rôle du système de build, qui déploie les fonctions Lambda novafact-*. Il est borné par une permissions boundary. Le compte contient aussi novafact-ops, le rôle d’exécution des fonctions d’administration : il fait confiance à lambda.amazonaws.com et porte AdministratorAccess.',
    code: `resource "aws_iam_role" "builder" {
  name                 = "novafact-builder"
  permissions_boundary = aws_iam_policy.builder_boundary.arn
  assume_role_policy   = data.aws_iam_policy_document.codebuild_trust.json
}

resource "aws_iam_role_policy" "builder" {
  role = aws_iam_role.builder.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "\${aws_s3_bucket.artifacts.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:CreateFunction", "lambda:UpdateFunctionCode", "lambda:InvokeFunction"]
        Resource = "arn:aws:lambda:eu-west-3:111122223333:function:novafact-*"
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_policy" "builder_boundary" {
  name = "builder-boundary"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:*", "lambda:*", "iam:PassRole", "logs:*"]
      Resource = "*"
    }]
  })
}`,
    issues: [
      { match: 'Action   = "iam:PassRole"', cats: [4], text: 'Seule, aucune de ces permissions n’est administrateur. Ensemble, elles le sont : créer une fonction novafact-x à laquelle on passe le rôle novafact-ops, l’invoquer, et le code tourne avec les droits d’administration. PassRole se borne à l’ARN du rôle d’exécution prévu, avec la condition iam:PassedToService = lambda.amazonaws.com.' },
    ],
    decoys: [
      { match: 'permissions_boundary = aws_iam_policy.builder_boundary.arn', text: 'La boundary plafonne ce que le rôle builder peut faire lui-même. Elle ne dit rien des droits du rôle qu’il passe à une fonction : c’est pour ça qu’elle ne protège pas ici, sans être fautive.' },
      { match: 'function:novafact-*', text: 'Un joker sur un préfixe de nom de fonction est une restriction réelle et courante. Le problème n’est pas quelle fonction on crée, mais avec quel rôle.' },
      { match: '["s3:*", "lambda:*", "iam:PassRole", "logs:*"]', text: 'Une boundary large n’accorde rien : elle ne fait que limiter. Les permissions effectives sont l’intersection avec la politique du rôle.' },
    ],
  },
  {
    id: 'identity-pool',
    level: 3,
    tags: ['identites', 'donnees'],
    file: 'infra/auth/identity-pool.tf',
    intro: 'L’identity pool Cognito qui donne aux utilisateurs connectés un accès direct à leurs PDF dans S3. L’application n’a pas de mode invité ; l’identifiant du pool figure dans le JavaScript du front.',
    code: `resource "aws_cognito_identity_pool" "web" {
  identity_pool_name               = "novafact_web"
  allow_unauthenticated_identities = true
  allow_classic_flow               = true

  cognito_identity_providers {
    client_id     = aws_cognito_user_pool_client.web.id
    provider_name = aws_cognito_user_pool.main.endpoint
  }
}

resource "aws_iam_role" "unauth" {
  name = "novafact-web-unauth"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = "cognito-identity.amazonaws.com" }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals             = { "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.web.id }
        "ForAnyValue:StringLike" = { "cognito-identity.amazonaws.com:amr" = "unauthenticated" }
      }
    }]
  })
}

resource "aws_iam_role_policy" "unauth" {
  role = aws_iam_role.unauth.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "\${aws_s3_bucket.invoices.arn}/*"
    }]
  })
}

resource "aws_iam_role_policy" "auth" {
  role = aws_iam_role.auth.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "\${aws_s3_bucket.invoices.arn}/$\${cognito-identity.amazonaws.com:sub}/*"
    }]
  })
}`,
    issues: [
      { match: 'allow_unauthenticated_identities = true', cats: [2], text: 'Sans mode invité, rien ne justifie les identités non authentifiées. Or il suffit de l’identifiant du pool, public, pour obtenir sans compte une identité anonyme et son jeton (GetId puis GetOpenIdToken).' },
      { match: 'allow_classic_flow               = true', cats: [4, 2], text: 'Dans le flux amélioré, Cognito ajoute aux identités anonymes une politique de session qui n’autorise qu’une liste de services, dont S3 ne fait pas partie. Le flux classique laisse échanger le jeton directement contre le rôle (AssumeRoleWithWebIdentity), sans ce garde-fou. AWS recommande de le laisser désactivé.' },
      { match: 'Resource = "${aws_s3_bucket.invoices.arn}/*"', cats: [2, 4], text: 'Et le rôle anonyme lit toutes les factures de tous les tenants. Aucune des trois lignes ne suffit seule : c’est leur combinaison qui rend le bucket public. Désactiver les identités non authentifiées et le flux classique, et ne jamais donner au rôle anonyme un accès aux données.' },
    ],
    decoys: [
      { match: '"cognito-identity.amazonaws.com:amr" = "unauthenticated"', text: 'La politique de confiance est correcte : elle vérifie le pool (aud) et le type d’identité (amr). Le rôle anonyme est bien réservé aux identités anonymes, c’est ce qu’on lui permet qui pose problème.' },
      { match: 'cognito-identity.amazonaws.com:sub}/*', text: 'La variable de politique limite chaque utilisateur connecté au préfixe de sa propre identité : le bon modèle. Le $$ n’est pas une faute de frappe : il empêche Terraform d’interpréter la variable IAM.' },
    ],
  },
  {
    id: 'referer-policy',
    level: 3,
    tags: ['donnees'],
    avoid: ['s3'],
    file: 'infra/storage/attachments.tf',
    intro: 'Les pièces jointes des factures (justificatifs, bons de commande) sont affichées dans l’application. Pour éviter de générer des URL présignées, l’équipe a limité l’accès aux requêtes venues de l’application.',
    code: `resource "aws_s3_bucket" "attachments" {
  bucket = "novafact-invoice-attachments"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket                  = aws_s3_bucket.attachments.id
  block_public_acls       = true
  block_public_policy     = false
  ignore_public_acls      = true
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.attachments.arn, "\${aws_s3_bucket.attachments.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
      {
        Sid       = "AppOnly"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "\${aws_s3_bucket.attachments.arn}/*"
        Condition = { StringLike = { "aws:Referer" = "https://*.novafact.example/*" } }
      },
    ]
  })
}`,
    issues: [
      { match: '"aws:Referer"', cats: [2], text: 'L’en-tête Referer est envoyé par le client, qui l’écrit comme il veut : curl -H "Referer: https://app.novafact.example/" suffit. La documentation AWS le dit elle-même, cette condition ne protège pas d’un accès non autorisé. Le bucket est public, avec un mot de passe écrit sur la porte.' },
      { match: 'block_public_policy     = false', cats: [2], text: 'S3 considère la politique comme publique (aws:Referer ne figure pas parmi les clés qui rendent une politique non publique) et l’aurait refusée. Désactiver ce garde-fou pour la faire passer était le signal d’alarme.' },
      { match: 'restrict_public_buckets = false', cats: [2], text: 'Même acceptée, une politique publique serait neutralisée par ce réglage. Les deux garde-fous ont été levés, précisément ceux qui empêchent ce bucket d’être public.' },
    ],
    decoys: [
      { match: 'Effect    = "Deny"', text: 'Un Deny pour tout principal quand la requête n’est pas en TLS : c’est la forme standard pour imposer HTTPS. Principal = "*" dans un Deny restreint, il n’ouvre rien.' },
      { match: 'sse_algorithm = "AES256"', text: 'SSE-S3 chiffre les objets au repos avec des clés gérées par S3. Suffisant ici, et sans rapport avec qui peut lire.' },
    ],
  },
  {
    id: 'lambda-s3-trigger',
    level: 3,
    tags: ['identites'],
    file: 'infra/imports/invoice-import.tf',
    intro: 'La fonction qui importe dans le grand livre les factures fournisseurs déposées dans S3. Chaque fichier traité produit des écritures comptables.',
    code: `resource "aws_lambda_function" "import_invoices" {
  function_name                  = "import-invoices"
  role                           = aws_iam_role.import.arn
  runtime                        = "nodejs22.x"
  handler                        = "index.handler"
  filename                       = "dist/import.zip"
  reserved_concurrent_executions = 5
  dead_letter_config {
    target_arn = aws_sqs_queue.import_dlq.arn
  }
}

resource "aws_lambda_permission" "from_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.import_invoices.function_name
  principal     = "s3.amazonaws.com"
}

resource "aws_s3_bucket_notification" "imports" {
  bucket = aws_s3_bucket.imports.id
  lambda_function {
    lambda_function_arn = aws_lambda_function.import_invoices.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "incoming/"
  }
  depends_on = [aws_lambda_permission.from_s3]
}

resource "aws_cloudwatch_log_group" "import" {
  name              = "/aws/lambda/import-invoices"
  retention_in_days = 3
}`,
    issues: [
      { match: 'principal     = "s3.amazonaws.com"', cats: [4, 2], text: 'Sans source_arn ni source_account, la permission vaut pour n’importe quel bucket de n’importe quel compte AWS : un tiers configure une notification vers cette fonction et lui fait importer ses propres fichiers. C’est le « confused deputy ». Les ARN de bucket ne contiennent pas de numéro de compte : AWS recommande les deux, source_arn et source_account.' },
      { match: 'retention_in_days = 3', cats: [7], text: 'Trois jours de journaux pour un traitement qui écrit dans la comptabilité : une écriture contestée le mois suivant ne se retrace plus. Aligner la rétention sur le besoin d’enquête, en mois.' },
    ],
    decoys: [
      { match: 'reserved_concurrent_executions = 5', text: 'Borne la concurrence de la fonction : une avalanche de fichiers ne sature pas la base. Bon réglage, sans lien avec qui peut l’invoquer.' },
      { match: 'filter_prefix       = "incoming/"', text: 'Le filtre ne concerne que la notification de ce bucket-ci. Il ne restreint en rien la permission, qui vit dans la politique de la fonction.' },
    ],
  },
];

// ── Les séries ──────────────────────────────────────────────────────────────

const mix = (n1: number, n2: number, n3: number): [number, number, number] => [n1, n2, n3];

const PROFILES: SeriesProfile<IacFile>[] = [
  { id: 'decouverte', title: 'Découverte', mix: mix(3, 0, 0), level: 1,
    text: 'Des valeurs qui se lisent seules : 0.0.0.0/0, encrypted = false, un mot de passe dans le code.' },
  { id: 'mise-en-jambe', title: 'Mise en jambe', ids: ['network', 's3', 'app'], level: 1,
    text: 'Le troisième fichier contient de bons réglages qui ont l’air suspects. Ils ne se signalent pas.' },
  { id: 'faux-amis', title: 'Faux amis', ids: ['cloudfront', 'iam', 'cdk-exports'], level: 2,
    text: 'kms:* pour le compte, un principal de service borné, une suppression voulue : chaque faux positif coûte.' },
  { id: 'donnees', title: 'Où sont les données', ids: ['opensearch', 'cloudfront', 'rds-snapshot'], level: 2,
    text: 'Buckets, bases, index, instantanés : trois façons de rendre des factures lisibles, de la plus visible à la plus détournée.' },
  { id: 'identites', title: 'Qui peut faire quoi', ids: ['stripe-secret', 'passrole', 'identity-pool'], level: 3,
    text: 'Politiques IAM, de clé et de ressource, fédération : du joker trop large à la permission qui ne devient dangereuse qu’avec une autre.' },
  { id: 'expert', title: 'Expert', ids: ['referer-policy', 'lambda-s3-trigger', 'rds-snapshot'], level: 3,
    text: 'Un attribut qui manque, une condition qui ne protège rien, deux ressources saines qui font un bucket public.' },
  { id: 'melee', title: 'Mêlée', mix: mix(1, 1, 1), level: 2, shuffleEachTime: true,
    text: 'Un fichier de chaque niveau, recomposée à chaque partie.' },
];

export const iacSeries = defineSeries(iacFiles, PROFILES);
