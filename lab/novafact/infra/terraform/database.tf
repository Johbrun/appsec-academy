# VULNÉRABLE — fixture du lab, ne pas réutiliser

resource "aws_db_subnet_group" "invoices" {
  name       = "novafact-invoices"
  subnet_ids = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

resource "aws_db_instance" "invoices" {
  identifier        = "novafact-invoices"
  engine            = "postgres"
  engine_version    = "15.7"
  instance_class    = "db.t3.medium"
  allocated_storage = 100

  db_name  = "novafact"
  username = "novafact_app"

  # « On le changera avant la mise en prod. » C'était en 2019. Ce mot de passe
  # est aussi dans le state, en clair, pour tout le monde qui peut le lire.
  password = "Tr0ub4dour-novafact-2019"

  db_subnet_group_name   = aws_db_subnet_group.invoices.name
  vpc_security_group_ids = [aws_security_group.db.id]

  publicly_accessible = true
  storage_encrypted   = false

  # Deux réglages qui ont l'air bons ici. Regarde d'où vient leur valeur.
  deletion_protection     = var.db_deletion_protection
  backup_retention_period = var.db_backup_retention_days

  skip_final_snapshot = true

  performance_insights_enabled = true
}
