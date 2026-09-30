resource "aws_s3_bucket" "logs" {
  bucket = "novafact-logs"
}

# CORRIGÉ : la piste d'audit couvre toutes les régions et valide ses fichiers.
#
# Multi-région, parce qu'un attaquant qui sait que seule eu-west-3 est
# enregistrée travaille depuis us-east-1. Validation d'intégrité, parce que
# c'est ce qui permet de prouver que les journaux n'ont pas été retouchés —
# couper ou réécrire la trace est la première chose qu'on essaie.
resource "aws_cloudtrail" "main" {
  name           = "novafact"
  s3_bucket_name = aws_s3_bucket.logs.id

  is_multi_region_trail         = true
  enable_log_file_validation    = true
  include_global_service_events = true
}

# CORRIGÉ : le trafic du VPC est journalisé, tout entier. `traffic_type =
# "REJECT"` seul ne montre que ce qui a été refusé — donc jamais l'exfiltration
# qui, elle, a réussi.
resource "aws_flow_log" "main" {
  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  log_destination_type     = "s3"
  log_destination          = aws_s3_bucket.logs.arn
  max_aggregation_interval = 60
}

resource "aws_ecs_task_definition" "api" {
  family                   = "novafact-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = "arn:aws:iam::111122223333:role/novafact-exec"

  # CORRIGÉ : chaque conteneur a son pilote de journalisation — le sidecar
  # aussi. Un conteneur sans logConfiguration écrit sur une sortie standard que
  # personne ne collecte : ce qui n'est pas journalisé n'existera pas le jour
  # de l'investigation.
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

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/novafact/api"
          "awslogs-region"        = "eu-west-3"
          "awslogs-stream-prefix" = "api"
        }
      }
    },
    {
      name      = "otel-sidecar"
      image     = "111122223333.dkr.ecr.eu-west-3.amazonaws.com/otel-collector:0.96.0"
      essential = false

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/novafact/api"
          "awslogs-region"        = "eu-west-3"
          "awslogs-stream-prefix" = "otel"
        }
      }
    },
  ])
}
