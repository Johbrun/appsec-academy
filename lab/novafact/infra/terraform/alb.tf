# VULNÉRABLE — fixture du lab, ne pas réutiliser

resource "aws_lb" "public" {
  name               = "novafact-public"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  # Aucun bloc access_logs : le jour de l'investigation, il n'y a rien à lire.
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

# Le port 80 sert l'application, il ne redirige pas.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.public.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.public.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn

  # Une politique de 2016 : TLS 1.0 et 1.1 y sont encore acceptés.
  ssl_policy = "ELBSecurityPolicy-2016-08"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
