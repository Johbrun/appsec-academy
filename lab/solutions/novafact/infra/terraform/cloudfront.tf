resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "Novafact"

  # CORRIGÉ : le lien entre le bord et l'origine est chiffré lui aussi. Un
  # `https-only` côté origine évite que le trafic reparte en clair dans le
  # réseau de l'hébergeur.
  origin {
    domain_name = aws_lb.public.dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # CORRIGÉ : la distribution est associée au pare-feu applicatif.
  web_acl_id = aws_wafv2_web_acl.app.arn

  default_cache_behavior {
    target_origin_id = "alb"
    allowed_methods  = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods   = ["GET", "HEAD"]

    # CORRIGÉ : plus de HTTP en clair. `https-only` convient aussi ;
    # `redirect-to-https` est plus tolérant pour les clients existants.
    viewer_protocol_policy = "redirect-to-https"

    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  }

  # CORRIGÉ : le comportement des pièces jointes aussi. Il ne suffit pas de
  # corriger celui par défaut — chaque comportement a sa propre politique.
  ordered_cache_behavior {
    path_pattern           = "/attachments/*"
    target_origin_id       = "alb"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = var.certificate_arn
    ssl_support_method  = "sni-only"

    # CORRIGÉ : TLS 1.2 au minimum côté visiteur.
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_wafv2_web_acl" "app" {
  name  = "novafact-app"
  scope = "CLOUDFRONT"

  # L'action par défaut reste `allow` : un pare-feu applicatif fonctionne en
  # laissant passer ce qu'aucune règle ne refuse. Ce qui manquait, c'est que
  # les règles refusent.
  default_action {
    allow {}
  }

  # CORRIGÉ : `override_action { none {} }` rend au groupe managé son action
  # propre — donc le blocage. En `count`, le groupe observe et laisse passer :
  # c'est utile deux semaines pour régler les faux positifs, pas neuf mois.
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # CORRIGÉ : une limite de débit au bord. Elle protège l'application de ce que
  # la limitation applicative ne voit jamais — le trafic qui l'aurait saturée
  # avant d'arriver au compteur.
  rule {
    name     = "RateLimit"
    priority = 10

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "novafact-app"
    sampled_requests_enabled   = true
  }
}
