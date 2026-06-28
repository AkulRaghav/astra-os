"""Tests for the automation engine."""

import pytest
from app.automation import (
    AutomationEngine, Workflow, WorkflowStep,
    TriggerType, ActionType,
)


@pytest.fixture
def engine():
    return AutomationEngine()


def test_register_workflow(engine):
    wf = Workflow(
        name="Test Workflow",
        user_id="user-1",
        trigger_type=TriggerType.EVENT,
        trigger_config={"event_type": "file_uploaded"},
        steps=[WorkflowStep(action=ActionType.SEND_NOTIFICATION)],
    )
    wf_id = engine.register_workflow(wf)
    assert wf_id == wf.id
    assert wf_id in engine.workflows


def test_remove_workflow(engine):
    wf = Workflow(name="To Remove", user_id="user-1")
    engine.register_workflow(wf)
    assert engine.remove_workflow(wf.id) is True
    assert engine.remove_workflow("nonexistent") is False


def test_list_workflows(engine):
    engine.register_workflow(Workflow(name="WF1", user_id="user-1"))
    engine.register_workflow(Workflow(name="WF2", user_id="user-1"))
    engine.register_workflow(Workflow(name="WF3", user_id="user-2"))

    user1_wfs = engine.list_workflows("user-1")
    assert len(user1_wfs) == 2

    user2_wfs = engine.list_workflows("user-2")
    assert len(user2_wfs) == 1


@pytest.mark.asyncio
async def test_trigger_event(engine):
    wf = Workflow(
        name="On Upload",
        user_id="user-1",
        trigger_type=TriggerType.EVENT,
        trigger_config={"event_type": "file_uploaded"},
        steps=[WorkflowStep(action=ActionType.SEND_NOTIFICATION, config={"title": "New file!"})],
    )
    engine.register_workflow(wf)

    executed = await engine.trigger_event("file_uploaded", {"file_id": "123"})
    assert wf.id in executed


@pytest.mark.asyncio
async def test_trigger_event_no_match(engine):
    wf = Workflow(
        name="On Upload",
        user_id="user-1",
        trigger_type=TriggerType.EVENT,
        trigger_config={"event_type": "file_uploaded"},
        steps=[],
    )
    engine.register_workflow(wf)

    executed = await engine.trigger_event("task_completed", {})
    assert len(executed) == 0


@pytest.mark.asyncio
async def test_inactive_workflow_not_triggered(engine):
    wf = Workflow(
        name="Disabled",
        user_id="user-1",
        trigger_type=TriggerType.EVENT,
        trigger_config={"event_type": "file_uploaded"},
        is_active=False,
        steps=[WorkflowStep(action=ActionType.SEND_NOTIFICATION)],
    )
    engine.register_workflow(wf)

    executed = await engine.trigger_event("file_uploaded", {})
    assert len(executed) == 0
