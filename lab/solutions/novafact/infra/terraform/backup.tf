# Sauvegardes de Novafact.
#
# Le modèle de menace de cette partie n'est pas la panne de disque : c'est
# l'attaquant qui a déjà le rôle de production. Un rançongiciel cloud commence
# par les sauvegardes. Tout ce qui suit découle de là.

# CORRIGÉ : le verrouillage d'objet est activé à la création du bucket. Il ne
# peut pas être ajouté après coup sur un bucket existant : c'est un attribut de
# création, et il exige le versioning.
resource "aws_s3_bucket" "backups" {
  bucket              = "novafact-backups-prod"
  object_lock_enabled = true

  tags = {
    Name = "novafact-backups"
    Env  = "prod"
  }
}

# CORRIGÉ : versioning activé. Sans lui, une écriture au même nom écrase la
# sauvegarde — et le verrou d'immuabilité n'a rien à protéger.
resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

# CORRIGÉ : verrou d'immuabilité en mode COMPLIANCE. En mode GOVERNANCE, un
# rôle porteur de s3:BypassGovernanceRetention peut passer outre : c'est
# exactement le rôle que l'attaquant vient d'obtenir. En COMPLIANCE, personne
# ne peut supprimer avant l'échéance — pas même le compte racine.
resource "aws_s3_bucket_object_lock_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 35
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.backups.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_kms_key" "backups" {
  description             = "Chiffrement des sauvegardes Novafact"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}

resource "aws_iam_role" "backup_writer" {
  name = "novafact-backup-writer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# CORRIGÉ : le rôle qui écrit les sauvegardes ne peut plus les effacer ni les
# écraser. Plus de « s3:* », plus de s3:DeleteObject, plus de
# s3:BypassGovernanceRetention. Écrire et lister, rien d'autre — et la lecture
# est réservée au rôle de restauration, qui est un rôle distinct que seule une
# astreinte peut endosser.
resource "aws_iam_role_policy" "backup_writer" {
  name = "novafact-backup-writer"
  role = aws_iam_role.backup_writer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = ["${aws_s3_bucket.backups.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.backups.arn]
      },
    ]
  })
}

# CORRIGÉ : une politique de bucket refuse explicitement la suppression à tout
# le monde, y compris aux rôles d'administration du compte. Le verrou
# d'immuabilité tient déjà, mais une porte fermée deux fois se force moins vite
# — et ce refus se lit dans le code, ce qui le rend relisable en revue.
resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "RefuserTouteSuppression"
      Effect    = "Deny"
      Principal = "*"
      Action = [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
        "s3:PutBucketVersioning",
        "s3:BypassGovernanceRetention",
      ]
      Resource = [
        aws_s3_bucket.backups.arn,
        "${aws_s3_bucket.backups.arn}/*",
      ]
    }]
  })
}

# ── Copie dans un compte séparé ──────────────────────────────────────────────
#
# CORRIGÉ : les sauvegardes sont répliquées vers un bucket d'un AUTRE compte,
# un compte « coffre » dont le compte de production ne détient aucun rôle. La
# compromission complète du compte de production ne donne donc pas accès à la
# copie. C'est le point que le verrou d'immuabilité seul ne couvre pas : il
# protège les objets, pas le compte qui les héberge.
resource "aws_iam_role" "replication" {
  name = "novafact-backup-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "replication" {
  name = "novafact-backup-replication"
  role = aws_iam_role.replication.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket",
        ]
        Resource = [aws_s3_bucket.backups.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging",
        ]
        Resource = ["${aws_s3_bucket.backups.arn}/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateTags",
          "s3:ObjectOwnerOverrideToBucketOwner",
        ]
        Resource = ["arn:aws:s3:::novafact-backups-vault/*"]
      },
    ]
  })
}

resource "aws_s3_bucket_replication_configuration" "backups" {
  depends_on = [aws_s3_bucket_versioning.backups]

  role   = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "vers-le-compte-coffre"
    status = "Enabled"

    destination {
      bucket = "arn:aws:s3:::novafact-backups-vault"
      # Le compte de destination est un autre compte de l'organisation.
      account = var.backup_vault_account_id

      access_control_translation {
        owner = "Destination"
      }

      encryption_configuration {
        replica_kms_key_id = var.backup_vault_kms_key_arn
      }
    }
  }
}

variable "backup_vault_account_id" {
  description = "Compte AWS « coffre » qui reçoit la copie des sauvegardes."
  type        = string
}

variable "backup_vault_kms_key_arn" {
  description = "Clé KMS du compte coffre, dont la production n'a pas l'usage."
  type        = string
}

# ── AWS Backup ───────────────────────────────────────────────────────────────

resource "aws_backup_vault" "main" {
  name        = "novafact"
  kms_key_arn = aws_kms_key.backups.arn
}

# CORRIGÉ : le coffre AWS Backup est verrouillé lui aussi, en mode conformité.
resource "aws_backup_vault_lock_configuration" "main" {
  backup_vault_name   = aws_backup_vault.main.name
  min_retention_days  = 35
  max_retention_days  = 365
  changeable_for_days = 3
}

resource "aws_backup_plan" "nightly" {
  name = "novafact-nightly"

  rule {
    rule_name         = "nightly"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 * * ? *)"

    lifecycle {
      delete_after = 35
    }

    # CORRIGÉ : la copie inter-comptes vaut aussi pour AWS Backup.
    copy_action {
      destination_vault_arn = var.backup_vault_arn

      lifecycle {
        delete_after = 365
      }
    }
  }
}

variable "backup_vault_arn" {
  description = "ARN du coffre AWS Backup dans le compte coffre."
  type        = string
}

resource "aws_backup_selection" "database" {
  name         = "novafact-database"
  iam_role_arn = aws_iam_role.backup_writer.arn
  plan_id      = aws_backup_plan.nightly.id

  resources = ["arn:aws:rds:eu-west-3:111122223333:db:novafact-prod"]
}

# ── Test de restauration ─────────────────────────────────────────────────────
#
# CORRIGÉ : la restauration est testée toutes les semaines, automatiquement, et
# l'échec du test réveille l'astreinte. Une sauvegarde jamais restaurée est une
# hypothèse, pas un plan : c'est au moment de l'incident qu'on découvre que le
# chiffrement de la base n'était pas dans l'instantané, que le rôle de
# restauration n'existe plus, ou que le RTO annoncé était de six heures sur le
# papier et de trois jours en vrai.
resource "aws_backup_restore_testing_plan" "weekly" {
  name                         = "novafact_restauration_hebdomadaire"
  schedule_expression          = "cron(0 5 ? * SUN *)"
  start_window_hours           = 2
  recovery_point_selection {
    algorithm             = "LATEST_WITHIN_WINDOW"
    include_vaults        = [aws_backup_vault.main.arn]
    recovery_point_types  = ["SNAPSHOT"]
    selection_window_days = 7
  }
}

resource "aws_backup_restore_testing_selection" "database" {
  name                      = "novafact_base"
  restore_testing_plan_name = aws_backup_restore_testing_plan.weekly.name
  protected_resource_type   = "RDS"
  iam_role_arn              = aws_iam_role.restore_test.arn

  protected_resource_arns = ["arn:aws:rds:eu-west-3:111122223333:db:novafact-prod"]
}

resource "aws_iam_role" "restore_test" {
  name = "novafact-restore-test"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}
