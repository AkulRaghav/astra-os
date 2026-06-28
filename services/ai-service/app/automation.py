"""AI Automation Engine - event-triggered workflows.

Users can define automations like:
- "Summarize new emails every morning and add to Notes"
- "When a file is uploaded, generate AI summary"
- "Daily task digest notification"

Workflows are triggered by Kafka events or scheduled cron-like jobs.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4


class TriggerType(str, Enum):
    EVENT = "event"       # Kafka event trigger
    SCHEDULE = "schedule"  # Cron-like schedule
    MANUAL = "manual"      # User-triggered


class ActionType(str, Enum):
    AI_SUMMARIZE = "ai_summarize"
    AI_CLASSIFY = "ai_classify"
    CREATE_NOTE = "create_note"
    CREATE_TASK = "create_task"
    SEND_NOTIFICATION = "send_notification"
    SEND_EMAIL = "send_email"
    WEBHOOK = "webhook"


@dataclass
class WorkflowStep:
    action: ActionType
    config: dict[str, Any] = field(default_factory=dict)


@dataclass
class Workflow:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    user_id: str = ""
    trigger_type: TriggerType = TriggerType.EVENT
    trigger_config: dict[str, Any] = field(default_factory=dict)
    steps: list[WorkflowStep] = field(default_factory=list)
    is_active: bool = True
    last_run: datetime | None = None
    created_at: datetime = field(default_factory=datetime.now)


class AutomationEngine:
    """Manages and executes user-defined automation workflows."""

    def __init__(self):
        self.workflows: dict[str, Workflow] = {}
        self._running = False

    async def start(self):
        """Start the automation engine."""
        self._running = True

    async def stop(self):
        """Stop the automation engine."""
        self._running = False

    def register_workflow(self, workflow: Workflow) -> str:
        """Register a new automation workflow."""
        self.workflows[workflow.id] = workflow
        return workflow.id

    def remove_workflow(self, workflow_id: str) -> bool:
        """Remove a workflow."""
        if workflow_id in self.workflows:
            del self.workflows[workflow_id]
            return True
        return False

    async def trigger_event(self, event_type: str, event_data: dict) -> list[str]:
        """Trigger all workflows matching the given event type.

        Returns list of workflow IDs that were executed.
        """
        executed = []
        for wf in self.workflows.values():
            if not wf.is_active:
                continue
            if wf.trigger_type != TriggerType.EVENT:
                continue
            if wf.trigger_config.get("event_type") == event_type:
                await self._execute_workflow(wf, event_data)
                executed.append(wf.id)
        return executed

    async def _execute_workflow(self, workflow: Workflow, context: dict) -> None:
        """Execute all steps in a workflow sequentially."""
        workflow.last_run = datetime.now()

        for step in workflow.steps:
            try:
                await self._execute_step(step, context, workflow.user_id)
            except Exception as e:
                # Log error but continue with next step
                print(f"Workflow step failed: {step.action} - {e}")

    async def _execute_step(
        self, step: WorkflowStep, context: dict, user_id: str
    ) -> dict:
        """Execute a single workflow step."""
        match step.action:
            case ActionType.AI_SUMMARIZE:
                from app.agents.orchestrator import AgentOrchestrator
                orchestrator = AgentOrchestrator()
                content = context.get("content", "")
                result = await orchestrator.process_message(
                    user_id=user_id,
                    conversation_id=f"automation_{step.action}",
                    message=f"Please summarize the following:\n\n{content}",
                    agent_type="assistant",
                )
                context["summary"] = result["content"]
                return result

            case ActionType.SEND_NOTIFICATION:
                # Would call notification service via gRPC/HTTP
                return {"sent": True, "title": step.config.get("title", "Automation")}

            case ActionType.CREATE_NOTE:
                # Would call notes API
                return {"created": True}

            case ActionType.CREATE_TASK:
                return {"created": True}

            case _:
                return {"skipped": True, "reason": f"Unknown action: {step.action}"}

    def list_workflows(self, user_id: str) -> list[Workflow]:
        """List all workflows for a user."""
        return [wf for wf in self.workflows.values() if wf.user_id == user_id]


# Global instance
automation_engine = AutomationEngine()
