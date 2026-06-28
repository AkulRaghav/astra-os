"""Data Analyst agent - data analysis, insights, visualizations."""

from app.agents.base import AgentContext, AgentMessage, BaseAgent
from app.llm import get_completion

SYSTEM_PROMPT = """You are Astra Data Analyst, an expert at analyzing data and generating insights.
You help users understand data patterns, create statistical analyses, and suggest visualizations.
When appropriate, provide Python code for data processing using pandas, matplotlib, or plotly.
Provide clear explanations of your findings.
If the user's request isn't data-related, include [HANDOFF:assistant]."""


class DataAnalystAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Data Analyst",
            agent_type="data_analyst",
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
