# VULNÉRABLE — fixture du lab, ne pas réutiliser

terraform {
  backend "s3" {
    bucket = "novafact-tfstate"
    key    = "prod/terraform.tfstate"
    region = "eu-west-3"
  }
}

# Le bucket qui porte le state. C'est le fichier qui décrit toute
# l'infrastructure — et qui contient ses secrets en clair.
resource "aws_s3_bucket" "tfstate" {
  bucket = "novafact-tfstate"
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = false
}
