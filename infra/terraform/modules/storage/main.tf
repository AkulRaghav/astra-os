variable "environment" {}

resource "aws_s3_bucket" "files" {
  bucket = "astra-files-${var.environment}"

  tags = {
    Name        = "astra-files"
    Environment = var.environment
  }
}

resource "aws_s3_bucket" "avatars" {
  bucket = "astra-avatars-${var.environment}"

  tags = {
    Name        = "astra-avatars"
    Environment = var.environment
  }
}

resource "aws_s3_bucket" "attachments" {
  bucket = "astra-attachments-${var.environment}"

  tags = {
    Name        = "astra-attachments"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

output "files_bucket" {
  value = aws_s3_bucket.files.id
}

output "avatars_bucket" {
  value = aws_s3_bucket.avatars.id
}

output "attachments_bucket" {
  value = aws_s3_bucket.attachments.id
}
