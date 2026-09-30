// Fichiers Terraform du jeu « IaC Misconfig Hunt » (M16).
import type { AuditCategory, AuditItem } from '../components/LineAudit';

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

export const iacFiles: AuditItem[] = [
  {
    id: 's3',
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
      { match: 'http_tokens   = "optional"', cats: [5], text: 'IMDSv1 reste possible : une SSRF sur l’instance peut lire les identifiants de son rôle. Exiger http_tokens = "required" (IMDSv2).' },
    ],
  },
  {
    id: 'iam',
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
  },
  {
    id: 'app',
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
  },
];
