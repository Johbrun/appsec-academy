# CORRIGÉ : c'est ici que le module devenait faux. Les valeurs par défaut de
# variables.tf étaient bonnes ; le fichier chargé automatiquement en production
# les défaisait, et rien dans database.tf ne le montrait.
#
# Lire la ressource ne suffit donc jamais : il faut suivre la variable jusqu'à
# sa valeur effective. C'est aussi ce que fait la vérification du lab.

environment = "prod"

db_deletion_protection   = true
db_backup_retention_days = 30
