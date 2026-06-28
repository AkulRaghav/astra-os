"""Tests for the multi-agent orchestrator."""

import pytest
from app.agents.orchestrator import AgentOrchestrator
from app.agents.base import AgentContext, AgentMessage


@pytest.fixture
def orchestrator():
    return AgentOrchestrator()


def test_orchestrator_has_all_agents(orchestrator):
    agents = orchestrator.list_agents()
    types = [a["type"] for a in agents]
    assert "assistant" in types
    assert "code_helper" in types
    assert "data_analyst" in types
    assert "content_writer" in types
    assert "researcher" in types


def test_orchestrator_get_agent(orchestrator):
    agent = orchestrator.get_agent("assistant")
    assert agent is not None
    assert agent.name == "AI Assistant"


def test_orchestrator_get_nonexistent_agent(orchestrator):
    agent = orchestrator.get_agent("nonexistent")
    assert agent is None


@pytest.mark.asyncio
async def test_process_message_without_api_key(orchestrator):
    """Without an API key, the system should return a stub response."""
    result = await orchestrator.process_message(
        user_id="test-user",
        conversation_id="test-conv",
        message="Hello, world!",
        agent_type="assistant",
    )
    assert result["conversation_id"] == "test-conv"
    assert result["agent_type"] == "assistant"
    assert "content" in result
    assert len(result["content"]) > 0


@pytest.mark.asyncio
async def test_process_message_with_history(orchestrator):
    result = await orchestrator.process_message(
        user_id="test-user",
        conversation_id="test-conv",
        message="What was my first question?",
        agent_type="assistant",
        history=[
            {"role": "user", "content": "What is Python?"},
            {"role": "assistant", "content": "Python is a programming language."},
        ],
    )
    assert "content" in result


@pytest.mark.asyncio
async def test_process_message_code_helper(orchestrator):
    result = await orchestrator.process_message(
        user_id="test-user",
        conversation_id="test-conv",
        message="Write a fizzbuzz function",
        agent_type="code_helper",
    )
    assert result["agent_type"] == "code_helper"


def test_clean_handoff_markers(orchestrator):
    cleaned = orchestrator._clean_handoff_markers(
        "Let me help you with that [HANDOFF:code_helper]"
    )
    assert "[HANDOFF:" not in cleaned
    assert "Let me help you with that" in cleaned
