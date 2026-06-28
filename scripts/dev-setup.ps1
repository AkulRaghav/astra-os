# Development environment setup script (Windows PowerShell)

Write-Host "🚀 Setting up Astra development environment..." -ForegroundColor Cyan

# Check prerequisites
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker is required but not installed." -ForegroundColor Red
    exit 1
}

# Copy env file if not exists
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "📝 Created .env file from .env.example - please fill in your API keys" -ForegroundColor Yellow
}

# Start infrastructure
Write-Host "🐳 Starting infrastructure services..." -ForegroundColor Green
docker compose -f infra/docker/docker-compose.yml up -d postgres redis minio kafka minio-init

Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Install frontend dependencies
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "📦 Installing Node.js dependencies..." -ForegroundColor Green
    npm install
}

Write-Host ""
Write-Host "✅ Development environment ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Available services:"
Write-Host "  PostgreSQL:  localhost:5432"
Write-Host "  Redis:       localhost:6379"
Write-Host "  MinIO:       localhost:9000 (Console: localhost:9001)"
Write-Host "  Kafka:       localhost:9092"
Write-Host ""
Write-Host "To start all application services:"
Write-Host "  docker compose -f infra/docker/docker-compose.yml up --build"
Write-Host ""
Write-Host "To start just the frontend:"
Write-Host "  npm run dev:web"
