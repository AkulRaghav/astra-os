"""Code Helper agent - code generation, debugging, review."""

from app.agents.base import AgentContext, AgentMessage, BaseAgent
from app.llm import get_completion

SYSTEM_PROMPT = """You are Astra Code Helper, an expert programming assistant.
You help users write, debug, review, and improve code.
Always provide clear explanations alongside code.
Support all major programming languages.
When showing code, use proper markdown code blocks with language tags.
If the user's request isn't code-related, include [HANDOFF:assistant] to go back to the general assistant."""


class CodeHelperAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Code Helper",
            agent_type="code_helper",
            system_prompt=SYSTEM_PROMPT,
        )

    async def process(self, context: AgentContext) -> AgentContext:
        messages = self.build_messages(context)
        response = await get_completion(messages, temperature=0.3, max_tokens=8192)

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
