# ASTRA — Architecture Document

## Overview

Astra is a browser-based AI operating system providing an integrated workspace with AI assistant, virtual file manager, terminal, code editor, browser, email, calendar, voice control, AI automation, plugin marketplace, multi-agent collaboration, cloud storage, and real-time collaboration.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  Next.js / React / TypeScript / Tailwind / Framer Motion / R3F  │
└─────────────────────┬──────────────────────┬────────────────────┘
                      │ GraphQL/REST          │ WebSocket
                      ▼                      ▼
┌─────────────────────────────┐  ┌───────────────────────────────┐
│     API Gateway (Go)        │  │    WS Gateway (Go)            │
│  - GraphQL aggregation      │  │  - Real-time channels         │
│  - REST endpoints           │  │  - Presence                   │
│  - Auth middleware          │  │  - Live collaboration         │
│  - Rate limiting            │  │  - Notifications              │
└──────────┬──────────────────┘  └──────────┬────────────────────┘
           │ gRPC                            │ gRPC
           ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE MESH (gRPC)                           │
├─────────────────┬──────────────────┬────────────────────────────┤
│  AI Service     │  Core Rust       │  Internal Services          │
│  (Python/       │  (Rust)          │  (Go - within gateway)      │
│   FastAPI)      │  - File ops      │  - Files, Notes, Tasks      │
│  - LangGraph    │  - Code sandbox  │  - Calendar, Mail           │
│  - Agents       │  - Performance   │  - Notifications            │
│  - RAG          │    critical ops  │  - Plugins, Analytics       │
│  - Voice/STT    │                  │  - Settings, Billing        │
└────────┬────────┴────────┬─────────┴──────────┬─────────────────┘
         │                 │                     │
         ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  PostgreSQL  │    Redis     │     S3       │    Kafka            │
│  + pgvector  │  - Sessions  │  - Files     │  - Event bus        │
│  - Primary   │  - Cache     │  - Avatars   │  - Async tasks      │
│    store     │  - Pub/Sub   │  - Attach.   │  - Cross-service    │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

## Monorepo Structure

```
/astra
├── apps/
│   └── web/                    # Next.js frontend
├── services/
│   ├── api-gateway/            # Go - GraphQL/REST entry point
│   ├── ws-gateway/             # Go - WebSocket real-time gateway
│   ├── ai-service/             # Python/FastAPI - AI orchestration
│   └── core-rust/              # Rust - performance-critical ops
├── packages/
│   └── shared/                 # Shared TypeScript types
├── infra/
│   ├── docker/                 # Docker Compose for local dev
│   ├── kubernetes/             # K8s manifests
│   └── terraform/              # IaC modules
├── proto/                      # gRPC .proto definitions
├── scripts/                    # Development & deployment scripts
└── .github/workflows/          # CI/CD pipelines
```

## Service Boundaries

| Service | Language | Responsibility |
|---------|----------|---------------|
| api-gateway | Go | Client-facing GraphQL/REST, auth, rate limiting, request routing |
| ws-gateway | Go | WebSocket connections, real-time channels, presence, pub/sub |
| ai-service | Python | AI agents, LangGraph orchestration, RAG, voice processing |
| core-rust | Rust | Sandboxed code execution, high-perf file operations, LSP proxy |

## Data Flow

1. **Authentication**: Client → API Gateway (JWT validation) → PostgreSQL (user lookup) → Redis (session cache)
2. **File Upload**: Client → API Gateway → S3 (file storage) → PostgreSQL (metadata) → Kafka (index event) → AI Service (embedding)
3. **AI Chat**: Client → API Gateway → AI Service (LangGraph) → Vector DB (context retrieval) → LLM → Response streamed via WS Gateway
4. **Real-time Collaboration**: Client → WS Gateway → Redis Pub/Sub → Other connected clients (CRDT sync)
5. **Notifications**: Any Service → Kafka (event) → Notification Service → Redis Pub/Sub → WS Gateway → Client

## Authentication & Security

- JWT-based auth with short-lived access tokens (15min) and long-lived refresh tokens (7 days)
- OAuth 2.0 / OIDC for Google, GitHub, Microsoft, Apple
- TOTP-based 2FA
- Session/device management with revocation capability
- All inter-service communication over gRPC with mTLS in production

## Database Design Principles

- PostgreSQL as single source of truth for all structured data
- pgvector extension for AI embedding storage and similarity search
- Redis for ephemeral data (sessions, cache, presence, pub/sub)
- S3 for binary/large object storage (files, images, attachments)
- Kafka for durable event streaming between services

## Observability

- Prometheus metrics from all services
- Grafana dashboards for system health
- Structured JSON logging to centralized log aggregation
- Distributed tracing via OpenTelemetry

## Production Deployment

### Infrastructure

Astra runs on Kubernetes (EKS/GKE) with the following infrastructure:

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloud Provider (AWS/GCP)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │ CDN/CloudFr │  │ ALB/Ingress │  │ Cert Manager       │  │
│  │ (static)    │  │ (TLS term)  │  │ (Let's Encrypt)    │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────────────┘  │
│         │                 │                                   │
│  ┌──────┴─────────────────┴──────────────────────────────┐  │
│  │              Kubernetes Cluster (3 nodes min)           │  │
│  │  ┌────────────┬─────────────┬──────────┬───────────┐  │  │
│  │  │api-gateway │ ws-gateway  │ai-service│ core-rust │  │  │
│  │  │  (3 pods)  │  (3 pods)   │(2-10 HPA)│ (3 pods) │  │  │
│  │  └────────────┴─────────────┴──────────┴───────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│         │                 │                 │                 │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────────────┐ │
│  │ RDS/CloudSQL│  │ ElastiCache │  │ S3/GCS              │ │
│  │ (PostgreSQL)│  │ (Redis)     │  │ (Object Storage)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Scaling Strategy

| Service | Strategy | Trigger | Min | Max |
|---------|----------|---------|-----|-----|
| api-gateway | Fixed | — | 3 | 3 |
| ws-gateway | Fixed | — | 3 | 3 |
| ai-service | HPA | CPU 70%, Memory 80% | 2 | 10 |
| core-rust | Fixed | — | 3 | 3 |
| PostgreSQL | Vertical + Read replicas | — | 1 primary | 3 read |
| Redis | Cluster mode | — | 3 nodes | 6 nodes |

- **Horizontal Pod Autoscaler (HPA)** scales the ai-service based on CPU/memory utilization
- **Topology spread constraints** ensure pods are distributed across availability zones
- **Pod Disruption Budgets** maintain minimum availability during node maintenance
- Database uses managed services (RDS/CloudSQL) with automated backups

### Monitoring

- **Prometheus** scrapes `/metrics` endpoints from all services
- **Grafana** dashboards cover: request rates, latency percentiles (p50/p95/p99), error rates, pod resource usage, database connection pool stats
- **Alerting** via Prometheus Alertmanager for: high error rates (>1%), latency spikes (p99 > 2s), pod crashes, disk/memory pressure
- **Distributed tracing** via OpenTelemetry with Jaeger/Tempo backend
- **Log aggregation** via Loki with structured JSON logs from all services

### Security Hardening

- All inter-service communication over gRPC with mTLS
- Security headers on all responses (HSTS, CSP, X-Frame-Options)
- Token bucket rate limiting per client IP
- Request body size limits (100MB max)
- Input validation middleware on all mutation endpoints
- Secrets managed via Kubernetes Secrets (with External Secrets Operator for production)
- Network policies restrict pod-to-pod communication to declared dependencies
- Non-root containers with read-only filesystems
