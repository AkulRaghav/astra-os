"""Configuration management for the AI service."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    port: int = 8082
    debug: bool = False

    # Database
    database_url: str = "postgresql://astra:astra@localhost:5432/astra"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # OpenAI / LLM (commented out — kept for future provider switching)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"

    # Google Gemini (disabled — quota issues)
    google_api_key: str = ""

    # Groq (active provider — free tier, fast, OpenAI-compatible)
    groq_api_key: str = ""

    # Resend (email sending)
    resend_api_key: str = ""

    # Vector DB
    vector_db_url: str = "postgresql://astra:astra@localhost:5432/astra"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # gRPC
    grpc_port: int = 50051

    model_config = {"env_prefix": "AI_", "env_file": ".env"}


settings = Settings()
