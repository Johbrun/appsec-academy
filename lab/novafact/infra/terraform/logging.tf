# VULNÉRABLE — fixture du lab, ne pas réutiliser

resource "aws_s3_bucket" "logs" {
  bucket = "novafact-logs"
}

# Une piste d'audit sur une seule région, sans validation d'intégrité : on ne
# peut ni voir ce qui s'est passé ailleurs, ni prouver qu'elle n'a pas été
# retouchée.
resource "aws_cloudtrail" "main" {
  name           = "novafact"
  s3_bucket_name = aws_s3_bucket.logs.id

  is_multi_region_trail         = false
  enable_log_file_validation    = false
  include_global_service_events = false
}

# Aucune ressource aws_flow_log : le trafic du VPC n'est pas journalisé.

resource "aws_ecs_task_definition" "api" {
  family                   = "novafact-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = "arn:aws:iam::111122223333:role/novafact-exec"

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "111122223333.dkr.ecr.eu-west-3.amazonaws.com/novafact-api:1.42.0"
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        },
      ]
    },
    {
      name      = "otel-sidecar"
      image     = "111122223333.dkr.ecr.eu-west-3.amazonaws.com/otel-collector:0.96.0"
      essential = false
    },
  ])
}
