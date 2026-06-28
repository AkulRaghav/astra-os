"""Chat endpoint for AI conversations — full multi-agent implementation."""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.agents.orchestrator import AgentOrchestrator
from app.local_lookup import route_message as local_lookup
from app.rag import rag_service

router = APIRouter()
orchestrator = AgentOrchestrator()


class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    agent_type: str = "assistant"
    history: list[dict] | None = None
    file_ids: list[str] | None = None
    user_id: str = "anonymous"


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    content: str
    agent_type: str
    handoffs: int = 0


@router.post("/send", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """Send a message to an AI agent and get a response.

    Route: local data lookup first, then OpenAI for general questions.
    """
    # Step 1: Try local data lookup (fast, free, no API call)
    local_answer = await local_lookup(request.message, request.user_id)
    if local_answer is not None:
        return ChatResponse(
            conversation_id=request.conversation_id,
            message_id=f"msg_{request.conversation_id}",
            content=local_answer,
            agent_type="assistant",
            handoffs=0,
        )

    # Step 2: Fall through to OpenAI via the agent orchestrator
    # Retrieve relevant context from user's documents
    rag_context = []
    if request.user_id != "anonymous":
        try:
            results = await rag_service.search(
                query=request.message,
                user_id=request.user_id,
                limit=3,
                min_score=0.7,
            )
            rag_context = [r.content for r in results]
        except Exception:
            pass  # RAG is best-effort, don't fail the chat

    # Process through agent orchestrator
    result = await orchestrator.process_message(
        user_id=request.user_id,
        conversation_id=request.conversation_id,
        message=request.message,
        agent_type=request.agent_type,
        history=request.history,
        rag_context=rag_context,
    )

    return ChatResponse(
        conversation_id=result["conversation_id"],
        message_id=f"msg_{request.conversation_id}",
        content=result["content"],
        agent_type=result["agent_type"],
        handoffs=result.get("handoffs", 0),
    )


@router.post("/stream")
async def stream_message(request: ChatRequest):
    """Stream a chat response token by token.

    Uses Server-Sent Events format for streaming.
    """
    async def generate():
        # Get full response (in production, use streaming LLM API)
        result = await orchestrator.process_message(
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            message=request.message,
            agent_type=request.agent_type,
            history=request.history,
        )

        content = result["content"]
        # Simulate token streaming
        words = content.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {chunk}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Retrieve conversation history."""
    return {
        "id": conversation_id,
        "messages": [],
        "agent_type": "assistant",
    }


@router.post("/index")
async def index_document(request: dict):
    """Index a document for RAG retrieval."""
    await rag_service.index_document(
        source_id=request.get("source_id", ""),
        source_type=request.get("source_type", "file"),
        user_id=request.get("user_id", ""),
        content=request.get("content", ""),
        metadata=request.get("metadata"),
    )
    return {"indexed": True}


@router.post("/search")
async def semantic_search(request: dict):
    """Semantic search across user's documents."""
    results = await rag_service.search(
        query=request.get("query", ""),
        user_id=request.get("user_id", ""),
        limit=request.get("limit", 5),
    )
    return {
        "results": [
            {"content": r.content, "source": r.source, "score": r.score}
            for r in results
        ]
    }
