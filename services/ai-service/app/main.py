"""Astra AI Service - Multi-agent orchestration powered by LangGraph."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import agents, chat, health, voice, mail, gmail, execute


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print(f"AI Service starting on port {settings.port}")
    yield
    # Shutdown
    print("AI Service shutting down")


app = FastAPI(
    title="Astra AI Service",
    version="0.1.0",
    description="Multi-agent AI orchestration for Astra OS",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router, tags=["health"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(voice.router, prefix="/api/v1/voice", tags=["voice"])
app.include_router(mail.router, prefix="/api/v1/mail", tags=["mail"])
app.include_router(gmail.router, prefix="/api/v1/gmail", tags=["gmail"])
app.include_router(execute.router, prefix="/api/v1/execute", tags=["execute"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
