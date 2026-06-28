variable "environment" {}
variable "vpc_id" {}
variable "subnet_ids" {}
variable "instance_class" {}

resource "aws_db_subnet_group" "main" {
  name       = "astra-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "astra-db-subnet-group"
    Environment = var.environment
  }
}

resource "aws_security_group" "db" {
  name_prefix = "astra-db-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  tags = {
    Name        = "astra-db-sg"
    Environment = var.environment
  }
}

resource "aws_rds_cluster" "main" {
  cluster_identifier = "astra-${var.environment}"
  engine             = "aurora-postgresql"
  engine_version     = "16.1"
  database_name      = "astra"
  master_username    = "astra_admin"
  master_password    = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
  skip_final_snapshot     = var.environment != "production"

  tags = {
    Environment = var.environment
  }
}

variable "db_password" {
  sensitive = true
  default   = "change-in-production"
}

output "endpoint" {
  value = aws_rds_cluster.main.endpoint
}
