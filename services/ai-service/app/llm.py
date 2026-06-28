"""
LLM client — Groq (OpenAI-compatible API, free tier, fast).

Model: llama-3.3-70b-versatile
Env var: AI_GROQ_API_KEY (read from .env, server-side only)
"""

import httpx
from app.config import settings

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def get_completion(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """Get a completion from Groq (Llama 3.3 70B)."""
    if not settings.groq_api_key:
        user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        return (
            f"[AI not configured] No GROQ_API_KEY set.\n\n"
            f"I received: \"{user_msg[:100]}\"\n\n"
            f"Set AI_GROQ_API_KEY in services/ai-service/.env"
        )

    try:
        body = {
            "model": model or "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                GROQ_URL,
                json=body,
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
            )

        if resp.status_code == 429:
            return "[Groq] Rate limited. Wait a moment and try again."
        if resp.status_code == 401:
            return "[Groq] Invalid API key. Check AI_GROQ_API_KEY in .env"
        if resp.status_code != 200:
            err = resp.json().get("error", {}).get("message", resp.text[:200])
            return f"[Groq Error] {resp.status_code}: {err}"

        data = resp.json()
        return data["choices"][0]["message"]["content"] or ""

    except httpx.TimeoutException:
        return "[Groq] Request timed out. Try again."
    except Exception as e:
        return f"[Groq Error] {str(e)}"


async def get_embedding(text: str) -> list[float]:
    return [0.0] * 768


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    return [[0.0] * 768 for _ in texts]
