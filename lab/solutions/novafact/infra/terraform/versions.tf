terraform {
  required_version = ">= 1.9, < 2.0"

  required_providers {
    # CORRIGÉ : la contrainte est bornée vers le haut. `~> 5.82` accepte les
    # 5.x à partir de 5.82 et refuse la 6.0 ; un `= 5.82.2` exact convient
    # aussi. Ce qui compte est qu'aucune version publiée après la revue ne
    # parte en production toute seule, et que .terraform.lock.hcl — produit par
    # `terraform init` et versionné — fige les empreintes réellement
    # téléchargées.
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.82"
    }

    # CORRIGÉ : un provider sans contrainte est un provider non épinglé.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
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

# CORRIGÉ : le module est épinglé sur une empreinte de commit. Une branche ou
# une étiquette peut être repointée par qui pousse dessus — c'est exactement le
# mécanisme de l'incident tj-actions/changed-files, transposé à l'IaC : le
# premier `apply` qui suit part en production.
module "vpc_endpoints" {
  source = "git::https://github.com/novafact/terraform-modules.git//vpc-endpoints?ref=9c4f1b2d7e6a5038cf21b940ae73d5c6081f2a4b"

  vpc_id     = aws_vpc.main.id
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

# CORRIGÉ : un module du registre se contraint comme un provider.
module "budget_alarms" {
  source  = "novafact/budget/aws"
  version = "~> 2.4"

  monthly_limit = 2000
  contact_email = "finops@novafact.example"
}
