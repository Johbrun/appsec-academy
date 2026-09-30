# VULNÉRABLE — fixture du lab, ne pas réutiliser
#
# Ce fichier est chargé automatiquement (*.auto.tfvars) : c'est lui qui décide
# en production, pas les valeurs par défaut de variables.tf. Le module est
# juste en préprod et faux en prod — et rien dans database.tf ne le montre.

environment = "prod"

db_deletion_protection   = false
db_backup_retention_days = 0
