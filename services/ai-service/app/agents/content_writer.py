"""Content Writer agent - drafting documents, emails, creative content."""

from app.agents.base import AgentContext, AgentMessage, BaseAgent
from app.llm import get_completion

SYSTEM_PROMPT = """You are Astra Content Writer, an expert at creating clear and engaging content.
You help users draft documents, emails, blog posts, reports, and creative writing.
Adapt your tone and style to match the user's needs.
Offer multiple options when the user is brainstorming.
If the user's request isn't writing-related, include [HANDOFF:assistant]."""


class ContentWriterAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Content Writer",
            agent_type="content_writer",
            system_prompt=SYSTEM_PROMPT,
        )

    async def process(self, context: AgentContext) -> AgentContext:
        messages = self.build_messages(context)
        response = await get_completion(messages, temperature=0.8)

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
