"""Voice assistant endpoints - Whisper STT and TTS."""

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

from app.voice import transcribe_audio, synthesize_speech
from app.agents.orchestrator import AgentOrchestrator

router = APIRouter()
orchestrator = AgentOrchestrator()


class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Transcribe audio to text using Whisper.

    Accepts audio files (webm, wav, mp3, m4a).
    Returns transcription with confidence score.
    """
    audio_data = await file.read()
    # Determine format from filename
    fmt = "webm"
    if file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext in ("wav", "mp3", "m4a", "webm", "ogg"):
            fmt = ext

    result = await transcribe_audio(audio_data, fmt)
    return result


@router.post("/transcribe-and-chat")
async def transcribe_and_chat(file: UploadFile = File(...)):
    """Transcribe audio and send to AI assistant in one step.

    This powers the Voice Assistant: speak → transcribe → AI response.
    """
    audio_data = await file.read()
    fmt = "webm"
    if file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        if ext in ("wav", "mp3", "m4a", "webm", "ogg"):
            fmt = ext

    # Transcribe
    transcription = await transcribe_audio(audio_data, fmt)
    user_text = transcription["text"]

    if not user_text or user_text.startswith("["):
        return {
            "transcription": transcription,
            "response": None,
        }

    # Send to AI
    result = await orchestrator.process_message(
        user_id="voice_user",
        conversation_id="voice_session",
        message=user_text,
        agent_type="assistant",
    )

    return {
        "transcription": transcription,
        "response": {
            "content": result["content"],
            "agent_type": result["agent_type"],
        },
    }


@router.post("/synthesize")
async def synthesize(request: TTSRequest):
    """Convert text to speech.

    Returns audio/mpeg bytes or JSON error.
    """
    audio = await synthesize_speech(request.text, request.voice)
    if audio:
        return Response(content=audio, media_type="audio/mpeg")
    return {"error": "TTS requires OPENAI_API_KEY", "audio_url": None}
