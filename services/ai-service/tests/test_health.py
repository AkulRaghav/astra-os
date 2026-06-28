"""Tests for AI service health endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def client():
    """Synchronous fixture that returns an async context manager factory."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_health_check(client):
    async with client as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ai-service"


@pytest.mark.asyncio
async def test_list_agents(client):
    async with client as ac:
        response = await ac.get("/api/v1/agents/")
    assert response.status_code == 200
    data = response.json()
    assert "agents" in data
    assert len(data["agents"]) == 5
    agent_types = [a["type"] for a in data["agents"]]
    assert "assistant" in agent_types
    assert "code_helper" in agent_types


@pytest.mark.asyncio
async def test_get_agent(client):
    async with client as ac:
        response = await ac.get("/api/v1/agents/agent_assistant")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "AI Assistant"
    assert data["type"] == "assistant"


@pytest.mark.asyncio
async def test_send_chat_message(client):
    async with client as ac:
        response = await ac.post("/api/v1/chat/send", json={
            "conversation_id": "conv-123",
            "message": "Hello",
            "agent_type": "assistant",
        })
    assert response.status_code == 200
    data = response.json()
    assert data["conversation_id"] == "conv-123"
    assert data["agent_type"] == "assistant"
