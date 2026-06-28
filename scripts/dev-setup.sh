#!/bin/bash
# Development environment setup script

set -e

echo "🚀 Setting up Astra development environment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required."; exit 1; }

# Copy env file if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file from .env.example - please fill in your API keys"
fi

# Start infrastructure
echo "🐳 Starting infrastructure services..."
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio kafka minio-init

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Install frontend dependencies
if command -v node >/dev/null 2>&1; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

echo ""
echo "✅ Development environment ready!"
echo ""
echo "Available services:"
echo "  PostgreSQL:  localhost:5432"
echo "  Redis:       localhost:6379"
echo "  MinIO:       localhost:9000 (Console: localhost:9001)"
echo "  Kafka:       localhost:9092"
echo ""
echo "To start all application services:"
echo "  docker compose -f infra/docker/docker-compose.yml up --build"
echo ""
echo "To start just the frontend:"
echo "  npm run dev:web"
