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

  # CORRIGÉ : IMDSv2 exigé, et un seul saut.
  #
  # `http_tokens = "required"` impose une requête PUT préalable pour obtenir un
  # jeton : une SSRF qui ne sait faire qu'un GET n'obtient plus rien. C'est le
  # contrôle qui aurait cassé la chaîne de Capital One.
  #
  # La limite de sauts empêche un conteneur d'atteindre les métadonnées de son
  # hôte — le paquet de réponse est jeté au premier routage. 1 pour une
  # instance nue, 2 seulement si des conteneurs en ont besoin.
  #
  # `http_endpoint = "disabled"` convient aussi quand l'instance n'a pas besoin
  # de ses métadonnées : il n'y a alors plus rien à atteindre du tout.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }
}

# CORRIGÉ : le rebond a disparu. Une machine d'administration joignable depuis
# Internet est une machine à patcher, à surveiller et à auditer ; la session
# managée (SSM Session Manager) rend le service sans rien exposer — connexion
# sortante depuis l'instance, autorisation par IAM, trace dans CloudTrail.
#
# Si un rebond devait rester, il lui faudrait le même bloc metadata_options :
# la vérification porte sur *toutes* les ressources concernées, pas sur celle
# qu'on a pensé à durcir.
