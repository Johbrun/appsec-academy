# VULNÉRABLE — fixture du lab, ne pas réutiliser

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

# Le répartiteur est public : ces deux règles-là sont légitimes.
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
    description = "HTTP public, redirigé"
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

# « Le rebond d'astreinte. » Il n'a jamais servi qu'une fois.
resource "aws_security_group" "bastion" {
  name        = "novafact-bastion"
  description = "Rebond d'administration"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH depuis le bureau"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.office_cidr]
  }

  ingress {
    description = "RDP pour le poste Windows de la compta"
    from_port   = 3389
    to_port     = 3389
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

resource "aws_security_group" "db" {
  name        = "novafact-db"
  description = "Base de données des factures"
  vpc_id      = aws_vpc.main.id
}

# « Pour que l'outil de reporting du prestataire y accède. »
resource "aws_vpc_security_group_ingress_rule" "db_postgres" {
  security_group_id = aws_security_group.db.id

  from_port   = 5432
  to_port     = 5432
  ip_protocol = "tcp"
  cidr_ipv4   = "0.0.0.0/0"
}
