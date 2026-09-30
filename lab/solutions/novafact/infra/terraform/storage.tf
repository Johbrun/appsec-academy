# CORRIGÉ : les trois annotations de suppression ont disparu — deux pour
# Checkov, une pour tfsec — parce que les défauts qu'elles taisaient ont été
# corrigés. Une suppression sans date ni motif est une dette anonyme : le
# scanner reste vert et plus personne ne sait pourquoi.
#
# Et un scanner en CI n'est utile que s'il bloque. En mode avertissement, il
# devient du bruit qu'on apprend à ignorer — comme un test instable.

resource "aws_s3_bucket" "attachments" {
  bucket = "novafact-attachments-prod"

  tags = {
    Name      = "Pièces jointes des factures"
    DataClass = "confidentiel"
  }
}

# CORRIGÉ : les quatre drapeaux à true. Ils sont indépendants : trois sur
# quatre laissent le bucket exposé par le chemin restant. Un
# `aws_s3_account_public_access_block` sur le compte entier est encore mieux —
# il couvre les buckets que personne n'a pensé à durcir.
resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORRIGÉ : chiffrement par défaut avec une clé gérée. La clé de compte (SSE-S3)
# suffit à la vérification ; une clé KMS ajoute une politique d'accès et une
# trace des déchiffrements.
resource "aws_s3_bucket_server_side_encryption_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "arn:aws:kms:eu-west-3:111122223333:key/00000000-0000-0000-0000-000000000000"
    }
    bucket_key_enabled = true
  }
}

# CORRIGÉ : le versioning est la seule protection contre l'écrasement et la
# suppression — y compris par un rançongiciel.
resource "aws_s3_bucket_versioning" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  versioning_configuration {
    status = "Enabled"
  }
}

# CORRIGÉ : les accès sont journalisés. Le jour de l'investigation, c'est la
# seule façon de répondre à « qu'est-ce qui a été téléchargé, et par qui ».
resource "aws_s3_bucket_logging" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3/attachments/"
}

resource "aws_cloudfront_origin_access_control" "attachments" {
  name                              = "novafact-attachments"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CORRIGÉ : l'accès passe par le contrôle d'origine, pas par une politique
# publique. Le principal est le service CloudFront, et la condition restreint
# à cette distribution-là : un autre compte qui pointerait sa propre
# distribution vers ce bucket serait refusé.
#
# Supprimer purement et simplement la politique aurait aussi fait passer la
# vérification — mais les pièces jointes ne seraient plus servies.
resource "aws_s3_bucket_policy" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.attachments.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.app.arn
          }
        }
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = { AWS = "*" }
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.attachments.arn,
          "${aws_s3_bucket.attachments.arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
    ]
  })
}
