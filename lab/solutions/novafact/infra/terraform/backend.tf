terraform {
  backend "s3" {
    bucket = "novafact-tfstate"
    key    = "prod/terraform.tfstate"
    region = "eu-west-3"

    # CORRIGÉ : le state est l'actif le plus sensible de l'IaC — il décrit
    # toute l'infrastructure et contient ses secrets. Chiffré au repos, avec
    # une clé qu'on gère (donc qu'on peut révoquer et dont on lit les accès),
    # et verrouillé pour que deux `apply` concurrents ne le corrompent pas.
    encrypt    = true
    kms_key_id = "arn:aws:kms:eu-west-3:111122223333:key/00000000-0000-0000-0000-000000000000"

    # `use_lockfile = true` (Terraform ≥ 1.10, verrou natif S3) répond au même
    # besoin et remplace la table DynamoDB.
    dynamodb_table = "novafact-tfstate-lock"

    # Le rôle qui planifie n'est pas celui qui applique : `terraform plan` en
    # lecture seule sur les ressources, `terraform apply` derrière une
    # approbation.
    role_arn = "arn:aws:iam::111122223333:role/novafact-terraform-apply"
  }
}

resource "aws_s3_bucket" "tfstate" {
  bucket = "novafact-tfstate"
}

# CORRIGÉ : les quatre verrous, pas trois. `restrict_public_buckets` est celui
# qu'on oublie, et c'est lui qui neutralise une politique publique déjà posée.
resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORRIGÉ : le versioning est ce qui permet de revenir en arrière après un
# `apply` fautif ou une suppression. Sans lui, une écriture du state est
# définitive.
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "arn:aws:kms:eu-west-3:111122223333:key/00000000-0000-0000-0000-000000000000"
    }
  }
}
