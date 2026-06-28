# Astra — Deployment Runbook

## Prerequisites

- Kubernetes cluster (1.28+) with `kubectl` configured
- Helm 3.x installed
- Docker registry access (ghcr.io)
- Terraform 1.5+ (for infrastructure provisioning)
- `hey` or `ab` installed for load testing (optional)

## Architecture Overview

Astra deploys as microservices on Kubernetes:

| Service | Replicas | Port | Protocol |
|---------|----------|------|----------|
| api-gateway | 3 | 8080 | HTTP/REST/GraphQL |
| ws-gateway | 3 | 8081 | WebSocket |
| ai-service | 2–10 (HPA) | 8000/50051 | HTTP/gRPC |
| core-rust | 3 | 50052 | gRPC |

---

## Deployment Steps

### 1. Provision Infrastructure

```bash
cd infra/terraform
terraform init
terraform plan -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

### 2. Create Namespace and Secrets

```bash
kubectl apply -f infra/kubernetes/namespace.yaml
# Edit secrets.yaml with actual base64-encoded values
kubectl apply -f infra/kubernetes/secrets.yaml
kubectl apply -f infra/kubernetes/configmap.yaml
```

### 3. Deploy Services

```bash
kubectl apply -f infra/kubernetes/core-rust.yaml
kubectl apply -f infra/kubernetes/ai-service.yaml
kubectl apply -f infra/kubernetes/api-gateway.yaml
kubectl apply -f infra/kubernetes/ws-gateway.yaml
kubectl apply -f infra/kubernetes/ingress.yaml
```

### 4. Verify Deployment

```bash
kubectl -n astra get pods
kubectl -n astra get svc
kubectl -n astra rollout status deployment/api-gateway
kubectl -n astra rollout status deployment/ai-service
```

### 5. Run Smoke Tests

```bash
curl -s https://api.astra.dev/health | jq .
# Expected: {"status":"healthy","service":"api-gateway"}
```

---

## Rolling Updates

```bash
# Update a single service image
kubectl -n astra set image deployment/api-gateway \
  api-gateway=ghcr.io/astra-os/api-gateway:NEW_SHA

# Monitor rollout
kubectl -n astra rollout status deployment/api-gateway

# Rollback if needed
kubectl -n astra rollout undo deployment/api-gateway
```

---

## Scaling

```bash
# Manual scale
kubectl -n astra scale deployment/api-gateway --replicas=5

# HPA is configured for ai-service (auto 2–10 pods)
kubectl -n astra get hpa
```

---

## Operational Procedures

### View Logs

```bash
# Tail logs from a service
kubectl -n astra logs -f deployment/api-gateway --all-containers

# Structured log query (if using Loki/Grafana)
# Filter by request ID: {namespace="astra"} |= "req-id-here"
```

### Database Operations

```bash
# Connect to PostgreSQL
kubectl -n astra exec -it deploy/postgres -- psql -U astra -d astra

# Run migrations (from local)
DATABASE_URL="..." go run ./cmd/migrate up
```

### Redis Operations

```bash
kubectl -n astra exec -it deploy/redis -- redis-cli
> INFO memory
> DBSIZE
```

### Certificate Renewal

Certificates are managed by cert-manager. Verify:

```bash
kubectl -n astra get certificates
kubectl -n astra describe certificate astra-tls
```

---

## Incident Response

### Service Unhealthy

1. Check pod status: `kubectl -n astra get pods`
2. Check events: `kubectl -n astra get events --sort-by='.lastTimestamp'`
3. Check logs: `kubectl -n astra logs deploy/<service> --tail=100`
4. Check resource usage: `kubectl -n astra top pods`

### High Latency

1. Check HPA status: `kubectl -n astra get hpa`
2. Check node resources: `kubectl top nodes`
3. Review Grafana dashboards for bottlenecks
4. Consider scaling: `kubectl -n astra scale deployment/<service> --replicas=N`

### Database Connection Issues

1. Verify secret values: `kubectl -n astra get secret astra-secrets -o yaml`
2. Test connectivity from pod: `kubectl -n astra exec deploy/api-gateway -- nc -zv postgres 5432`
3. Check connection pool metrics on `/metrics`

---

## Environment Variable Reference

See [docs/env-reference.md](./env-reference.md) for a complete list of all environment variables.

---

## Monitoring Endpoints

| Endpoint | Service | Purpose |
|----------|---------|---------|
| `/health` | api-gateway | Liveness/readiness |
| `/metrics` | api-gateway | Prometheus metrics |
| `/health` | ai-service | Liveness/readiness |
| `/metrics` | ai-service | Prometheus metrics |
