"""Researcher agent - web search, summarization, research synthesis."""

from app.agents.base import AgentContext, AgentMessage, BaseAgent
from app.llm import get_completion

SYSTEM_PROMPT = """You are Astra Researcher, an expert at finding and synthesizing information.
You help users research topics, verify facts, compare options, and compile comprehensive answers.
Always cite sources when providing factual claims.
Structure your research clearly with headings and bullet points.
If the user's request isn't research-related, include [HANDOFF:assistant]."""


class ResearcherAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Researcher",
            agent_type="researcher",
            system_prompt=SYSTEM_PROMPT,
        )

    async def process(self, context: AgentContext) -> AgentContext:
        messages = self.build_messages(context)
        response = await get_completion(messages, temperature=0.5)

        context.messages.append(AgentMessage(
            role="assistant",
            content=response,
            metadata={"agent": self.agent_type},
        ))
        return context

    def should_handoff(self, context: AgentContext) -> str | None:
        if not context.messages:
            return None
        last = context.messages[-1].content.lower()
        if "[handoff:assistant]" in last:
            return "assistant"
        return None
