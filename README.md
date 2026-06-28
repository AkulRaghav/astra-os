<div align="center">

# ✦ ASTRA OS

### Browser-Based AI Operating System

[![Built with Go](https://img.shields.io/badge/Backend-Go-00ADD8?style=flat&logo=go)](https://go.dev)
[![Python](https://img.shields.io/badge/AI_Service-Python-3776AB?style=flat&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/Frontend-React_19-61DAFB?style=flat&logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Core-Rust-000000?style=flat&logo=rust)](https://rust-lang.org)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat&logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat&logo=postgresql)](https://postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<br/>

**An all-in-one AI workspace that runs entirely in the browser — effectively an operating system with AI assistant, virtual file manager, terminal, code editor, email, calendar, voice control, AI automation, plugin marketplace, and real-time collaboration.**

[Demo](#demo) · [Features](#features) · [Architecture](#architecture) · [Quick Start](#quick-start) · [Tech Stack](#tech-stack)

</div>

---

## 🎯 Demo

| Module | Screenshot |
|--------|-----------|
| Dashboard | Real-time metrics, recent files, task progress |
| AI Assistant | Multi-turn chat powered by Groq (Llama 3.3 70B) |
| Code Editor | Multi-file, multi-language with real execution |
| Terminal | AI-powered code execution in 9+ languages |
| Mail | Real Gmail integration + email sending via Resend |

---

## ✨ Features

### Core Modules

| Module | Status | Description |
|--------|--------|-------------|
| 🏠 **Dashboard** | ✅ Live | Real storage metrics, recent files, task progress, activity chart |
| 🤖 **AI Assistant** | ✅ Live | Multi-turn chat with Llama 3.3 70B via Groq, system prompt, local data lookup |
| 📁 **Files** | ✅ Live | Upload, create folders, delete, search, storage quota tracking |
| 💻 **Terminal** | ✅ Live | Real code execution (Python/Node local), AI-powered for other languages |
| 🔧 **Code Editor** | ✅ Live | Multi-file, 13 languages, real execution, auto-save |
| 📅 **Calendar** | ✅ Live | Day/Week/Month/Year views, event CRUD, color-coded |
| ✉️ **Mail** | ✅ Live | Real Gmail inbox (OAuth), send via Resend API |
| ✅ **Tasks** | ✅ Live | CRUD with priority, status transitions, filters |
| 📝 **Notes** | ✅ Live | Create/edit/delete with auto-save, full-text search |
| 🤖 **AI Agents** | ✅ Live | 5 specialized agents (Code, Data, Writer, Researcher, Assistant) |
| 🎨 **Workspace** | ✅ Live | Whiteboard with shapes, freehand, connectors, text |
| 📊 **Analytics** | ✅ Live | Real usage stats from DB (files, tasks, storage, activity) |
| 🔌 **Plugins** | ✅ Live | GitHub, Slack, Notion, Figma, Linear — connect/disconnect |
| 🔔 **Notifications** | ✅ Live | Activity-based, filter, mark read, clear |
| 👤 **Profile** | ✅ Live | Edit name, bio, avatar — persists to DB |
| ⚙️ **Settings** | ✅ Live | Preferences, security, billing (Razorpay), API keys |
| 🌐 **Browser** | 🔜 Soon | Integrated browser (planned) |

### AI Features

| Feature | Implementation |
|---------|---------------|
| Multi-Agent Orchestration | LangGraph-style routing between 5 specialized agents |
| Local Data Lookup | Questions about your files/tasks/storage answered from Postgres (no API call) |
| Multi-Turn Context | Last 20 messages sent as history for contextual responses |
| System Prompt | Editable at `services/ai-service/app/prompts/assistant_system_prompt.py` |
| Code Generation | AI generates code from natural language prompts |
| Auto-Fix | Compilation errors auto-corrected and re-executed |
| RAG Pipeline | Document embedding + semantic search via pgvector |

### Integrations

| Service | Type | Status |
|---------|------|--------|
| Google OAuth | Authentication | ✅ Working |
| Gmail API | Email reading | ✅ Working |
| Resend | Email sending | ✅ Working |
| Groq | LLM (Llama 3.3 70B) | ✅ Working |
| Razorpay | Payments (₹20/₹100 plans) | ✅ Working |
| GitHub | Plugin (OAuth) | ✅ Connect flow |
| Slack | Plugin (OAuth) | ✅ Connect flow |
| Notion | Plugin (OAuth) | ✅ Connect flow |
| Figma | Plugin (OAuth) | ✅ Connect flow |
| Linear | Plugin (OAuth) | ✅ Connect flow |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│     React 19 / TypeScript / Tailwind / Framer Motion / R3F      │
└─────────────────────┬──────────────────────┬────────────────────┘
                      │ REST/GraphQL          │ WebSocket
                      ▼                      ▼
┌─────────────────────────────┐  ┌───────────────────────────────┐
│     API Gateway (Go)        │  │    WS Gateway (Go)            │
│  - Auth (JWT + OAuth)       │  │  - Real-time channels         │
│  - REST + GraphQL           │  │  - Presence & notifications   │
│  - Rate limiting            │  │  - WebRTC signaling           │
└──────────┬──────────────────┘  └──────────────────────────────-┘
           │ gRPC
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI Service (Python/FastAPI)    │  Core Service (Rust)          │
│  - Groq LLM integration        │  - Sandboxed code execution   │
│  - Multi-agent orchestration    │  - File operations            │
│  - Local data lookup            │  - Performance-critical ops   │
│  - Gmail API / Resend           │                               │
└─────────────────────────────────┴───────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL + pgvector  │  Redis  │  S3/MinIO  │  Kafka        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **Go** 1.22+
- **Python** 3.11+
- **PostgreSQL** 16+
- **Rust** 1.76+ (optional, for core service)

### Setup

```bash
git clone https://github.com/AkulRaghav/astra-os.git
cd astra-os

# Setup database
psql -U postgres -c "CREATE USER astra WITH PASSWORD 'astra' SUPERUSER;"
psql -U postgres -c "CREATE DATABASE astra OWNER astra;"
psql -U astra -d astra -f infra/docker/init-db/001_schema.sql
psql -U astra -d astra -f infra/docker/init-db/002_seed.sql

# Install frontend
cd apps/web && npm install && cd ../..

# Configure AI service
echo "AI_GROQ_API_KEY=your_key_here" > services/ai-service/.env

# Start all services
cd services/api-gateway && go run ./cmd/server &
cd services/ai-service && uvicorn app.main:app --port 8082 &
cd apps/web && npx vite --port 3000
```

Open **http://localhost:3000**

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TanStack Router, Tailwind CSS 4, Framer Motion, React Three Fiber |
| API Gateway | Go, Chi router, JWT auth, GraphQL, gRPC |
| WebSocket Gateway | Go, Gorilla WebSocket, Redis Pub/Sub |
| AI Service | Python, FastAPI, Groq SDK, asyncpg, httpx |
| Core Service | Rust, Tonic (gRPC), Tokio |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis |
| Object Storage | S3-compatible (MinIO for dev) |
| Event Bus | Kafka |
| Payments | Razorpay |
| Email | Resend API + Gmail API (OAuth) |
| LLM | Groq (Llama 3.3 70B Versatile) |
| Infrastructure | Docker, Kubernetes, Terraform (AWS) |
| CI/CD | GitHub Actions |

---

## 📁 Project Structure

```
astra-os/
├── apps/web/                  # React frontend (Vite)
│   ├── src/routes/            # All page components
│   ├── src/components/        # UI components
│   └── src/lib/               # API client, store, WebSocket
├── services/
│   ├── api-gateway/           # Go REST/GraphQL/Auth
│   ├── ws-gateway/            # Go WebSocket real-time
│   ├── ai-service/            # Python AI orchestration
│   │   ├── app/agents/        # Multi-agent system
│   │   ├── app/local_lookup/  # Postgres data queries
│   │   ├── app/prompts/       # Editable system prompts
│   │   └── app/routes/        # API endpoints
│   └── core-rust/             # Rust performance service
├── packages/shared/           # TypeScript types
├── proto/                     # gRPC definitions
├── infra/
│   ├── docker/                # Docker Compose + DB schema
│   ├── kubernetes/            # K8s manifests (8 files)
│   └── terraform/             # AWS IaC (VPC, RDS, EKS, S3)
├── docs/                      # Deployment runbook, env reference
├── scripts/                   # Dev setup, load testing
└── .github/workflows/         # CI/CD pipeline
```

---

## 🔐 Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `AI_GROQ_API_KEY` | ai-service | Groq API key for LLM |
| `AI_RESEND_API_KEY` | ai-service | Resend API key for email |
| `GOOGLE_CLIENT_ID` | api-gateway | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | api-gateway | Google OAuth secret |
| `DATABASE_URL` | api-gateway | PostgreSQL connection |
| `JWT_SECRET` | api-gateway | JWT signing key |

See [docs/env-reference.md](docs/env-reference.md) for the complete list.

---

## 📄 License

MIT © [Akul Raghav](https://github.com/AkulRaghav)

---

<div align="center">

**Built with ❤️ by [Akul Raghav](https://github.com/AkulRaghav)**

*Full-stack engineer who ships production systems end-to-end.*

</div>
