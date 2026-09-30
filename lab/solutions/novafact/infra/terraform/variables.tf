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

# CORRIGÉ : la variable office_cidr a disparu avec le rebond qu'elle ouvrait.
# Un CIDR « du bureau » dans une variable est un trou qui s'élargit tout seul :
# il n'y a plus d'accès administratif entrant du tout, la session managée
# (SSM Session Manager) le remplace.

# CORRIGÉ : les valeurs par défaut n'ont pas changé — elles étaient déjà
# justes. Le défaut était dans prod.auto.tfvars, qui les écrasait.
variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "db_backup_retention_days" {
  type    = number
  default = 7

  validation {
    condition     = var.db_backup_retention_days >= 7
    error_message = "Une base de production conserve au moins sept jours de sauvegardes."
  }
}
