# VULNÉRABLE — fixture du lab, ne pas réutiliser

terraform {
  required_version = ">= 1.5"

  required_providers {
    # La contrainte est ouverte vers le haut : le prochain `init` prendra
    # n'importe quelle version publiée depuis, y compris une 6.x.
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }

    random = {
      source = "hashicorp/random"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Application = "novafact"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Un module maison, tiré d'une branche. Celui qui pousse sur cette branche
# décide de ce que le prochain `apply` déploie en production.
module "vpc_endpoints" {
  source = "git::https://github.com/novafact/terraform-modules.git//vpc-endpoints?ref=main"

  vpc_id     = aws_vpc.main.id
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

# Un module du registre public, sans contrainte de version.
module "budget_alarms" {
  source = "novafact/budget/aws"

  monthly_limit = 2000
  contact_email = "finops@novafact.example"
}
