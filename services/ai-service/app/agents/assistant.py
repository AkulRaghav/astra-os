"""General-purpose AI Assistant agent."""

from app.agents.base import AgentContext, AgentMessage, BaseAgent
from app.llm import get_completion
from app.prompts.assistant_system_prompt import SYSTEM_PROMPT


class AssistantAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="AI Assistant",
            agent_type="assistant",
            system_prompt=SYSTEM_PROMPT,
        )

    async def process(self, context: AgentContext) -> AgentContext:
        messages = self.build_messages(context)
        response = await get_completion(messages)

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
        if "[handoff:code_helper]" in last:
            return "code_helper"
        if "[handoff:data_analyst]" in last:
            return "data_analyst"
        if "[handoff:content_writer]" in last:
            return "content_writer"
        if "[handoff:researcher]" in last:
            return "researcher"
        return None
