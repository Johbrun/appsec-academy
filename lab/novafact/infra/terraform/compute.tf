# VULNÉRABLE — fixture du lab, ne pas réutiliser

resource "aws_iam_instance_profile" "app" {
  name = "novafact-app"
  role = "novafact-app"
}

resource "aws_launch_template" "app" {
  name_prefix            = "novafact-app-"
  image_id               = var.ami_id
  instance_type          = "t3.medium"
  vpc_security_group_ids = [aws_security_group.app.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  # Le service de métadonnées répond encore à un simple GET, et la réponse
  # traverse deux sauts de plus que nécessaire.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "optional"
    http_put_response_hop_limit = 3
  }
}

# Le rebond n'a aucun bloc metadata_options : IMDSv1 par défaut.
resource "aws_instance" "bastion" {
  ami                    = var.ami_id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.bastion.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name
}
