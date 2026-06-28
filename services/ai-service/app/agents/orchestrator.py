"""LangGraph-based multi-agent orchestrator."""

from typing import Any

from app.agents.assistant import AssistantAgent
from app.agents.base import AgentContext, AgentMessage, BaseAgent
from app.agents.code_helper import CodeHelperAgent
from app.agents.content_writer import ContentWriterAgent
from app.agents.data_analyst import DataAnalystAgent
from app.agents.researcher import ResearcherAgent


class AgentOrchestrator:
    """Orchestrates multiple AI agents using a graph-based routing approach.

    Implements the core LangGraph pattern: route user messages to the appropriate
    agent, handle hand-offs between agents, and maintain shared context.
    """

    def __init__(self):
        self.agents: dict[str, BaseAgent] = {
            "assistant": AssistantAgent(),
            "code_helper": CodeHelperAgent(),
            "data_analyst": DataAnalystAgent(),
            "content_writer": ContentWriterAgent(),
            "researcher": ResearcherAgent(),
        }
        self.max_handoffs = 3  # Prevent infinite loops

    async def process_message(
        self,
        user_id: str,
        conversation_id: str,
        message: str,
        agent_type: str = "assistant",
        history: list[dict[str, Any]] | None = None,
        rag_context: list[str] | None = None,
    ) -> dict[str, Any]:
        """Process a user message through the agent graph.

        Routes to the appropriate agent, handles hand-offs,
        and returns the final response.
        """
        # Build context
        context = AgentContext(
            user_id=user_id,
            conversation_id=conversation_id,
            rag_context=rag_context or [],
        )

        # Load history
        if history:
            for msg in history:
                context.messages.append(AgentMessage(
                    role=msg.get("role", "user"),
                    content=msg.get("content", ""),
                    metadata=msg.get("metadata", {}),
                ))

        # Add current message
        context.messages.append(AgentMessage(role="user", content=message))

        # Route through agents
        current_agent_type = agent_type
        handoffs = 0

        while handoffs < self.max_handoffs:
            agent = self.agents.get(current_agent_type)
            if not agent:
                agent = self.agents["assistant"]
                current_agent_type = "assistant"

            # Process with current agent
            context = await agent.process(context)

            # Check for handoff
            next_agent = agent.should_handoff(context)
            if next_agent and next_agent != current_agent_type:
                context.handoff_reason = f"Handing off from {current_agent_type} to {next_agent}"
                current_agent_type = next_agent
                handoffs += 1
                # Clean handoff marker from response
                if context.messages:
                    last_msg = context.messages[-1]
                    last_msg.content = self._clean_handoff_markers(last_msg.content)
            else:
                break

        # Extract final response
        response_msg = context.messages[-1] if context.messages else None
        return {
            "content": response_msg.content if response_msg else "I'm not sure how to help with that.",
            "agent_type": current_agent_type,
            "conversation_id": conversation_id,
            "handoffs": handoffs,
            "tools_used": context.tools_used,
        }

    def _clean_handoff_markers(self, text: str) -> str:
        """Remove [HANDOFF:...] markers from text."""
        import re
        return re.sub(r"\[HANDOFF:\w+\]", "", text).strip()

    def get_agent(self, agent_type: str) -> BaseAgent | None:
        return self.agents.get(agent_type)

    def list_agents(self) -> list[dict]:
        return [
            {
                "type": agent_type,
                "name": agent.name,
            }
            for agent_type, agent in self.agents.items()
        ]
