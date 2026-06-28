"""Voice processing - Speech-to-Text (Whisper) and Text-to-Speech."""

from app.config import settings


async def transcribe_audio(audio_data: bytes, audio_format: str = "webm") -> dict:
    """Transcribe audio using OpenAI Whisper API.

    Returns transcription text, confidence, and detected language.
    """
    if not settings.openai_api_key:
        return {
            "text": "[Whisper transcription requires OPENAI_API_KEY]",
            "confidence": 0.0,
            "language": "en",
        }

    from openai import AsyncOpenAI
    import tempfile
    import os

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # Write audio to temp file (Whisper API requires file upload)
    suffix = f".{audio_format}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_data)
        temp_path = f.name

    try:
        with open(temp_path, "rb") as audio_file:
            response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
            )

        return {
            "text": response.text,
            "confidence": getattr(response, "confidence", 0.95),
            "language": getattr(response, "language", "en"),
        }
    finally:
        os.unlink(temp_path)


async def synthesize_speech(text: str, voice: str = "alloy") -> bytes | None:
    """Convert text to speech using OpenAI TTS API.

    Returns audio bytes (mp3) or None if API key not set.
    """
    if not settings.openai_api_key:
        return None

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text,
    )

    return response.content
