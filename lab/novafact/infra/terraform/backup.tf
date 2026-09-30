# VULNÉRABLE — fixture du lab, ne pas réutiliser
#
# Sauvegardes de Novafact. Elles vivent dans le compte de production, le
# versioning est suspendu, rien ne les rend immuables, et le rôle applicatif a
# « s3:* » dessus. Aucune restauration n'a jamais été testée : la dernière fois
# qu'on a essayé, c'était pendant la recette, il y a deux ans.

resource "aws_s3_bucket" "backups" {
  bucket = "novafact-backups-prod"

  tags = {
    Name = "novafact-backups"
    Env  = "prod"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    # Suspendu « parce que ça coûtait cher en stockage ».
    status = "Suspended"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
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

# Le rôle qui écrit les sauvegardes peut aussi les effacer : un attaquant qui
# obtient ce rôle supprime la sauvegarde avant de chiffrer la production.
resource "aws_iam_role_policy" "backup_writer" {
  name = "novafact-backup-writer"
  role = aws_iam_role.backup_writer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:*"]
      Resource = [
        aws_s3_bucket.backups.arn,
        "${aws_s3_bucket.backups.arn}/*",
      ]
    }]
  })
}

resource "aws_backup_vault" "main" {
  name = "novafact"
}

resource "aws_backup_plan" "nightly" {
  name = "novafact-nightly"

  rule {
    rule_name         = "nightly"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 * * ? *)"

    lifecycle {
      delete_after = 30
    }
  }
}

resource "aws_backup_selection" "database" {
  name         = "novafact-database"
  iam_role_arn = aws_iam_role.backup_writer.arn
  plan_id      = aws_backup_plan.nightly.id

  resources = ["arn:aws:rds:eu-west-3:111122223333:db:novafact-prod"]
}
