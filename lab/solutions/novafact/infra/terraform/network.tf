resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.42.0.0/20"
  availability_zone       = "eu-west-3a"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.42.16.0/20"
  availability_zone       = "eu-west-3b"
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.42.64.0/20"
  availability_zone = "eu-west-3a"
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.42.80.0/20"
  availability_zone = "eu-west-3b"
}

# Inchangé : un répartiteur public écoute sur 80 et 443. Ouvrir ces deux ports
# au monde est la fonction du service, pas un défaut — la vérification ne s'en
# prend qu'aux ports d'administration et de base de données.
resource "aws_security_group" "alb" {
  name        = "novafact-alb"
  description = "Répartiteur public"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS public"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP public, redirigé vers HTTPS par le listener"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app" {
  name        = "novafact-app"
  description = "Tâches applicatives"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Trafic venant du répartiteur"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# CORRIGÉ : le rebond d'administration a disparu, et son groupe avec lui.
# Pas d'accès administratif entrant du tout : la session managée (SSM Session
# Manager) ouvre une connexion sortante depuis l'instance, donc aucun port à
# exposer, une trace dans CloudTrail, et l'autorisation par IAM plutôt que par
# la possession d'une clé SSH.
#
# Refermer un port d'administration sur le CIDR « du bureau » aurait aussi fait
# passer la vérification — mais un CIDR de bureau finit toujours par
# s'élargir, et ne survit pas au télétravail.

resource "aws_security_group" "db" {
  name        = "novafact-db"
  description = "Base de données des factures"
  vpc_id      = aws_vpc.main.id
}

# CORRIGÉ : la base n'est plus joignable que depuis le groupe de
# l'application. La source est un groupe de sécurité, pas un CIDR : elle suit
# les tâches quand elles changent d'adresse, et il n'y a aucune plage à tenir
# à jour.
resource "aws_vpc_security_group_ingress_rule" "db_postgres" {
  security_group_id = aws_security_group.db.id

  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.app.id
}
