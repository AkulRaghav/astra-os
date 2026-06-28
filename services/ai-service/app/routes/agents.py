"""Agent management and automation endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.agents.orchestrator import AgentOrchestrator
from app.automation import AutomationEngine, Workflow, WorkflowStep, TriggerType, ActionType

router = APIRouter()
orchestrator = AgentOrchestrator()
automation = AutomationEngine()

# Pre-configured agents metadata
BUILTIN_AGENTS = [
    {
        "id": "agent_assistant",
        "name": "AI Assistant",
        "type": "assistant",
        "description": "General-purpose AI assistant for everyday tasks",
        "capabilities": ["chat", "summarize", "explain", "brainstorm"],
        "model": "gpt-4-turbo-preview",
        "is_active": True,
    },
    {
        "id": "agent_code_helper",
        "name": "Code Helper",
        "type": "code_helper",
        "description": "AI-powered code generation, debugging, and explanation",
        "capabilities": ["code_generation", "debugging", "code_review", "refactoring"],
        "model": "gpt-4-turbo-preview",
        "is_active": True,
    },
    {
        "id": "agent_data_analyst",
        "name": "Data Analyst",
        "type": "data_analyst",
        "description": "Analyze data, generate insights, and create visualizations",
        "capabilities": ["data_analysis", "visualization", "statistics", "reporting"],
        "model": "gpt-4-turbo-preview",
        "is_active": True,
    },
    {
        "id": "agent_content_writer",
        "name": "Content Writer",
        "type": "content_writer",
        "description": "Draft documents, emails, and creative content",
        "capabilities": ["writing", "editing", "formatting", "translation"],
        "model": "gpt-4-turbo-preview",
        "is_active": True,
    },
    {
        "id": "agent_researcher",
        "name": "Researcher",
        "type": "researcher",
        "description": "Web search, summarization, and research synthesis",
        "capabilities": ["web_search", "summarization", "fact_checking", "citation"],
        "model": "gpt-4-turbo-preview",
        "is_active": True,
    },
]


@router.get("/")
async def list_agents():
    """List all available AI agents."""
    return {"agents": BUILTIN_AGENTS}


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get details of a specific agent."""
    for agent in BUILTIN_AGENTS:
        if agent["id"] == agent_id:
            return agent
    return {"error": "Agent not found"}


# --- Automation Endpoints ---

class CreateWorkflowRequest(BaseModel):
    name: str
    user_id: str
    trigger_type: str = "event"
    trigger_config: dict = {}
    steps: list[dict] = []


@router.post("/automation/workflows")
async def create_workflow(request: CreateWorkflowRequest):
    """Create a new automation workflow."""
    workflow = Workflow(
        name=request.name,
        user_id=request.user_id,
        trigger_type=TriggerType(request.trigger_type),
        trigger_config=request.trigger_config,
        steps=[
            WorkflowStep(
                action=ActionType(s.get("action", "send_notification")),
                config=s.get("config", {}),
            )
            for s in request.steps
        ],
    )
    wf_id = automation.register_workflow(workflow)
    return {"id": wf_id, "name": workflow.name, "is_active": True}


@router.get("/automation/workflows")
async def list_workflows(user_id: str = ""):
    """List all automation workflows for a user."""
    workflows = automation.list_workflows(user_id)
    return {
        "workflows": [
            {"id": wf.id, "name": wf.name, "is_active": wf.is_active}
            for wf in workflows
        ]
    }


@router.delete("/automation/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """Delete an automation workflow."""
    removed = automation.remove_workflow(workflow_id)
    return {"deleted": removed}


@router.post("/automation/trigger")
async def trigger_automation(request: dict):
    """Manually trigger automations for a given event type."""
    event_type = request.get("event_type", "")
    event_data = request.get("data", {})
    executed = await automation.trigger_event(event_type, event_data)
    return {"executed_workflows": executed}
