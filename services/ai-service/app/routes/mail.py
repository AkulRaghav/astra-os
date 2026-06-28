"""Email sending via Resend API."""

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter()

RESEND_URL = "https://api.resend.com/emails"


class SendEmailRequest(BaseModel):
    to: list[str]
    subject: str
    body: str
    cc: list[str] | None = None


class SendEmailResponse(BaseModel):
    success: bool
    message: str
    id: str | None = None


@router.post("/send", response_model=SendEmailResponse)
async def send_email(request: SendEmailRequest):
    """Send a real email via Resend API."""
    if not settings.resend_api_key:
        return SendEmailResponse(success=False, message="Email not configured. Set AI_RESEND_API_KEY.", id=None)

    try:
        body = {
            "from": "Astra <onboarding@resend.dev>",
            "to": request.to,
            "subject": request.subject,
            "html": f"<div style='font-family:sans-serif;'>{request.body.replace(chr(10), '<br>')}</div>",
        }
        if request.cc:
            body["cc"] = request.cc

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                RESEND_URL,
                json=body,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
            )

        if resp.status_code in (200, 201):
            data = resp.json()
            return SendEmailResponse(success=True, message="Email sent!", id=data.get("id"))
        else:
            error = resp.json().get("message", resp.text[:200])
            return SendEmailResponse(success=False, message=f"Failed: {error}", id=None)

    except Exception as e:
        return SendEmailResponse(success=False, message=f"Error: {str(e)}", id=None)
