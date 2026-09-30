resource "aws_lb" "public" {
  name               = "novafact-public"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  # CORRIGÉ : les journaux d'accès du répartiteur sont souvent la seule trace
  # d'une attaque protocolaire — désynchronisation de requêtes, empoisonnement
  # de cache — parce qu'elle ne laisse rien dans les journaux applicatifs.
  # Les activer relève autant de la détection que du durcissement.
  access_logs {
    bucket  = aws_s3_bucket.logs.id
    prefix  = "alb/novafact-public"
    enabled = true
  }

  # Les en-têtes mal formés sont jetés plutôt que transmis : c'est la moitié du
  # correctif contre la désynchronisation.
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "app" {
  name        = "novafact-app"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    path    = "/api/health"
    matcher = "200"
  }
}

# CORRIGÉ : le port 80 ne sert plus l'application, il redirige. Le fermer
# complètement marcherait aussi, mais un client qui tape l'URL sans schéma
# obtiendrait une erreur de connexion au lieu d'arriver en HTTPS.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      protocol    = "HTTPS"
      port        = "443"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.public.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn

  # CORRIGÉ : une politique qui n'accepte plus TLS 1.0 ni 1.1.
  # `ELBSecurityPolicy-TLS-1-2-Ext-2018-06` ou une politique `FS-1-2`
  # conviennent aussi — ce qui compte est le plancher, pas le nom.
  ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
