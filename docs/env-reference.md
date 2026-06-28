# Astra — Environment Variable Reference

All environment variables used across Astra services.

## Database

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | api-gateway, ws-gateway | `postgres://astra:astra@localhost:5432/astra?sslmode=disable` | PostgreSQL connection string |
| `DATABASE_HOST` | k8s configmap | — | PostgreSQL host (k8s only) |
| `DATABASE_PORT` | k8s configmap | `5432` | PostgreSQL port (k8s only) |
| `DATABASE_NAME` | k8s configmap | `astra` | Database name (k8s only) |

## Redis

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `REDIS_URL` | api-gateway, ws-gateway | `redis://localhost:6379/0` | Redis connection string |

## JWT / Authentication

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `JWT_SECRET` | api-gateway | (required) | HMAC signing key for JWTs |
| `JWT_ACCESS_EXPIRY` | api-gateway | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | api-gateway | `168h` | Refresh token TTL (7 days) |

## OAuth Providers

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | api-gateway | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | api-gateway | — | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | api-gateway | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | api-gateway | — | GitHub OAuth client secret |
| `MICROSOFT_CLIENT_ID` | api-gateway | — | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | api-gateway | — | Microsoft OAuth client secret |
| `APPLE_CLIENT_ID` | api-gateway | — | Apple OAuth client ID |
| `APPLE_CLIENT_SECRET` | api-gateway | — | Apple OAuth client secret |

## S3 / Object Storage

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `S3_ENDPOINT` | api-gateway | `http://localhost:9000` | S3-compatible endpoint (MinIO for dev) |
| `S3_BUCKET` | api-gateway | `astra-files` | Storage bucket name |
| `S3_ACCESS_KEY` | api-gateway | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | api-gateway | `minioadmin` | S3 secret key |
| `S3_REGION` | api-gateway | `us-east-1` | S3 region |

## AI / LLM

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `OPENAI_API_KEY` | ai-service | (required) | OpenAI API key for LLM calls |
| `AI_MODEL` | ai-service | `gpt-4o` | Default LLM model |
| `AI_TEMPERATURE` | ai-service | `0.7` | Default generation temperature |
| `AI_MAX_TOKENS` | ai-service | `4096` | Max response tokens |
| `VECTOR_DB_URL` | ai-service | — | pgvector / vector store connection |

## Billing (Stripe)

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `STRIPE_SECRET_KEY` | api-gateway | — | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | api-gateway | — | Stripe webhook signing secret |

## Email / SMTP

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `SMTP_HOST` | api-gateway | — | SMTP server host |
| `SMTP_PORT` | api-gateway | `587` | SMTP server port |
| `SMTP_USER` | api-gateway | — | SMTP username |
| `SMTP_PASSWORD` | api-gateway | — | SMTP password |
| `EMAIL_FROM` | api-gateway | `noreply@astra.dev` | Sender email address |

## Application

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `PORT` | api-gateway | `8080` | HTTP listen port |
| `WS_PORT` | ws-gateway | `8081` | WebSocket listen port |
| `BASE_URL` | api-gateway | `http://localhost:8080` | Public API base URL |
| `FRONTEND_URL` | api-gateway | `http://localhost:3000` | Frontend app URL (CORS, redirects) |
| `CORS_ORIGIN` | api-gateway | `http://localhost:3000` | Allowed CORS origin |

## Service Discovery (inter-service)

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `AI_SERVICE_URL` | api-gateway | `localhost:50051` | AI service gRPC address |
| `RUST_SERVICE_URL` | api-gateway | `localhost:50052` | Core Rust gRPC address |
| `WS_GATEWAY_URL` | api-gateway | `localhost:8081` | WebSocket gateway address |

## Rate Limiting

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `RATE_LIMIT_MAX_TOKENS` | api-gateway | `100` | Token bucket burst size |
| `RATE_LIMIT_REFILL_RATE` | api-gateway | `10` | Tokens per second refill rate |

## Observability

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `LOG_LEVEL` | all | `info` | Log level (debug, info, warn, error) |
| `LOG_FORMAT` | all | `json` | Log format (json, text) |
| `OTEL_EXPORTER_ENDPOINT` | all | — | OpenTelemetry collector endpoint |

## WebSocket Gateway

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `WS_MAX_CONNECTIONS` | ws-gateway | `10000` | Max concurrent WebSocket connections |
| `WS_PING_INTERVAL` | ws-gateway | `30s` | WebSocket ping interval |
| `WS_READ_BUFFER_SIZE` | ws-gateway | `1024` | Read buffer size in bytes |
| `WS_WRITE_BUFFER_SIZE` | ws-gateway | `1024` | Write buffer size in bytes |

## Core Rust Service

| Variable | Service(s) | Default | Description |
|----------|-----------|---------|-------------|
| `RUST_LOG` | core-rust | `info` | Rust log filter |
| `SANDBOX_TIMEOUT_MS` | core-rust | `30000` | Code execution sandbox timeout |
| `SANDBOX_MEMORY_MB` | core-rust | `256` | Sandbox memory limit |
| `MAX_FILE_SIZE_MB` | core-rust | `100` | Max processable file size |
