# CORRIGÉ : la base n'est plus dans les sous-réseaux publics. Un sous-réseau
# privé n'a pas de route vers la passerelle Internet : même si
# `publicly_accessible` repassait à true par accident, il n'y aurait pas de
# chemin.
resource "aws_db_subnet_group" "invoices" {
  name       = "novafact-invoices"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_db_instance" "invoices" {
  identifier        = "novafact-invoices"
  engine            = "postgres"
  engine_version    = "15.7"
  instance_class    = "db.t3.medium"
  allocated_storage = 100

  db_name  = "novafact"
  username = "novafact_app"

  # CORRIGÉ : le secret ne passe plus par le code, donc plus par le state.
  # `manage_master_user_password` fait générer et faire tourner le mot de passe
  # par Secrets Manager : Terraform ne le voit jamais, et il n'y a plus
  # d'attribut `password`.
  #
  # Deux autres corrections passent la vérification :
  #   password = data.aws_secretsmanager_secret_version.db.secret_string
  #   password = var.db_password   # avec sensitive = true et aucun default
  #
  # La première est la plus proche de l'esprit — le secret vit côté
  # gestionnaire et le code n'en tient qu'une référence. Mais attention : dès
  # que la valeur traverse Terraform, elle est écrite en clair dans le state.
  # C'est pour ça que `manage_master_user_password` est meilleur que les deux
  # autres : la valeur ne traverse rien.
  manage_master_user_password = true
  master_user_secret_kms_key_id = "arn:aws:kms:eu-west-3:111122223333:key/00000000-0000-0000-0000-000000000000"

  db_subnet_group_name   = aws_db_subnet_group.invoices.name
  vpc_security_group_ids = [aws_security_group.db.id]

  # CORRIGÉ : les cinq réglages qui font une base de production.
  publicly_accessible = false
  storage_encrypted   = true
  kms_key_id          = "arn:aws:kms:eu-west-3:111122223333:key/00000000-0000-0000-0000-000000000000"

  # CORRIGÉ (indirectement) : ces deux lignes n'ont pas bougé. Leur valeur,
  # si : c'est prod.auto.tfvars qui les défaisait. Un module peut être juste en
  # préproduction et faux en production parce que le défaut est dans la
  # variable, pas dans la ressource.
  deletion_protection     = var.db_deletion_protection
  backup_retention_period = var.db_backup_retention_days

  skip_final_snapshot       = false
  final_snapshot_identifier = "novafact-invoices-final"

  performance_insights_enabled = true
}
