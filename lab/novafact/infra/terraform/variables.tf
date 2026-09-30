# VULNÉRABLE — fixture du lab, ne pas réutiliser

variable "region" {
  type    = string
  default = "eu-west-3"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "ami_id" {
  type    = string
  default = "ami-0000000000novafact"
}

variable "certificate_arn" {
  type    = string
  default = "arn:aws:acm:eu-west-3:111122223333:certificate/00000000-0000-0000-0000-000000000000"
}

# « Le CIDR du bureau. » Il a été élargi un vendredi soir de 2021 et personne
# ne l'a refermé depuis.
variable "office_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

# Les deux variables ci-dessous ont l'air justes. Elles le sont — en
# préproduction. Voir prod.auto.tfvars.
variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}
