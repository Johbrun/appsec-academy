# VULNÉRABLE — fixture du lab, ne pas réutiliser

#checkov:skip=CKV_AWS_18:la journalisation des accès coûte cher, on verra au T3
#checkov:skip=CKV_AWS_21:le versioning fait exploser la facture
#tfsec:ignore:aws-s3-enable-bucket-encryption

resource "aws_s3_bucket" "attachments" {
  bucket = "novafact-attachments-prod"

  tags = {
    Name       = "Pièces jointes des factures"
    DataClass  = "confidentiel"
  }
}

# Les quatre verrous sont là… et tous ouverts.
resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# « Le plus simple pour que la distribution serve les PDF. »
resource "aws_s3_bucket_policy" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicRead"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.attachments.arn,
          "${aws_s3_bucket.attachments.arn}/*",
        ]
      },
    ]
  })
}

resource "aws_cloudfront_origin_access_control" "attachments" {
  name                              = "novafact-attachments"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Ni chiffrement par défaut, ni versioning, ni journalisation des accès :
# les trois ressources qui devraient suivre n'ont jamais été écrites.
