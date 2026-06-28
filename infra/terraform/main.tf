terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }

  backend "s3" {
    bucket = "astra-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# --- Variables ---

variable "aws_region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment (staging, production)"
  default     = "staging"
}

variable "db_instance_class" {
  description = "RDS instance class"
  default     = "db.t3.medium"
}

# --- Networking ---

module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  aws_region  = var.aws_region
}

# --- Database ---

module "database" {
  source = "./modules/database"

  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  instance_class = var.db_instance_class
}

# --- Redis ---

module "redis" {
  source = "./modules/redis"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
}

# --- S3 ---

module "storage" {
  source = "./modules/storage"

  environment = var.environment
}

# --- EKS ---

module "eks" {
  source = "./modules/eks"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
}

# --- Outputs ---

output "database_endpoint" {
  value     = module.database.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.redis.endpoint
  sensitive = true
}

output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}
