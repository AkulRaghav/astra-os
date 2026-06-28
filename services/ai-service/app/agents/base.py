"""Base agent definition for the multi-agent system."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentMessage:
    """A message in the agent conversation."""
    role: str  # "user", "assistant", "system"
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentContext:
    """Shared context passed between agents."""
    user_id: str
    conversation_id: str
    messages: list[AgentMessage] = field(default_factory=list)
    files: list[dict] = field(default_factory=list)
    tools_used: list[dict] = field(default_factory=list)
    handoff_reason: str | None = None
    rag_context: list[str] = field(default_factory=list)


class BaseAgent(ABC):
    """Base class for all AI agents."""

    def __init__(self, name: str, agent_type: str, system_prompt: str):
        self.name = name
        self.agent_type = agent_type
        self.system_prompt = system_prompt

    @abstractmethod
    async def process(self, context: AgentContext) -> AgentContext:
        """Process the context and return updated context with response."""
        ...

    def should_handoff(self, context: AgentContext) -> str | None:
        """Determine if this agent should hand off to another. Returns target agent type or None."""
        return None

    def build_messages(self, context: AgentContext) -> list[dict]:
        """Build the message list for LLM call."""
        messages = [{"role": "system", "content": self.system_prompt}]
        for msg in context.messages:
            messages.append({"role": msg.role, "content": msg.content})
        if context.rag_context:
            rag_text = "\n\n".join(context.rag_context)
            messages.insert(1, {
                "role": "system",
                "content": f"Relevant context from user's documents:\n{rag_text}",
            })
        return messages
