"""Gmail inbox reading via Google OAuth + Gmail API."""

import httpx
import os
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from app.config import settings

router = APIRouter()

# Store tokens in memory (per-user in production use DB)
_gmail_tokens: dict[str, dict] = {}

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = "http://localhost:8080/auth/oauth/gmail/callback"
SCOPES = "https://www.googleapis.com/auth/gmail.readonly"


@router.get("/connect")
async def gmail_connect():
    """Redirect user to Google consent screen for Gmail access."""
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={SCOPES}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def gmail_callback(code: str = ""):
    """Handle OAuth callback from Google, exchange code for tokens."""
    if not code:
        return {"error": "No code provided"}

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        })

    if resp.status_code != 200:
        return {"error": f"Token exchange failed: {resp.text}"}

    tokens = resp.json()
    # Store tokens (keyed by "default" user for now)
    _gmail_tokens["default"] = tokens

    # Redirect to frontend mail page
    return RedirectResponse(url="http://localhost:3000/app/mail?gmail=connected")


@router.get("/inbox")
async def gmail_inbox(max_results: int = 20):
    """Fetch real emails from Gmail inbox."""
    tokens = _gmail_tokens.get("default")
    if not tokens:
        return {"emails": [], "error": "Not connected. Visit /api/v1/gmail/connect first."}

    access_token = tokens.get("access_token", "")

    # Refresh token if we have a refresh_token (for long-lived access)
    # For now, use the access token directly

    async with httpx.AsyncClient() as client:
        # Get message list
        resp = await client.get(
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults={max_results}&labelIds=INBOX",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if resp.status_code == 401:
        # Token expired, try refresh
        refresh = tokens.get("refresh_token")
        if refresh:
            new_tokens = await _refresh_token(refresh)
            if new_tokens:
                _gmail_tokens["default"] = {**tokens, **new_tokens}
                # Retry
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        f"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults={max_results}&labelIds=INBOX",
                        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
                    )
            else:
                return {"emails": [], "error": "Token expired. Reconnect Gmail."}

    if resp.status_code != 200:
        return {"emails": [], "error": f"Gmail API error ({resp.status_code})"}

    messages = resp.json().get("messages", [])
    if not messages:
        return {"emails": []}

    # Fetch details for each message
    access = _gmail_tokens["default"].get("access_token", access_token)
    emails = []
    async with httpx.AsyncClient() as client:
        for msg in messages[:max_results]:
            detail = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date",
                headers={"Authorization": f"Bearer {access}"},
            )
            if detail.status_code == 200:
                data = detail.json()
                headers = {h["name"]: h["value"] for h in data.get("payload", {}).get("headers", [])}
                emails.append({
                    "id": data["id"],
                    "subject": headers.get("Subject", "(no subject)"),
                    "from": headers.get("From", "Unknown"),
                    "date": headers.get("Date", ""),
                    "snippet": data.get("snippet", ""),
                    "is_read": "UNREAD" not in data.get("labelIds", []),
                })

    return {"emails": emails}


@router.get("/message/{msg_id}")
async def gmail_message(msg_id: str):
    """Fetch full email content."""
    tokens = _gmail_tokens.get("default")
    if not tokens:
        return {"error": "Not connected"}

    access_token = tokens.get("access_token", "")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if resp.status_code != 200:
        return {"error": f"Failed to fetch message ({resp.status_code})"}

    data = resp.json()
    headers = {h["name"]: h["value"] for h in data.get("payload", {}).get("headers", [])}

    # Extract body
    body = ""
    payload = data.get("payload", {})
    if payload.get("body", {}).get("data"):
        import base64
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    elif payload.get("parts"):
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                import base64
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                break
            elif part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
                import base64
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")

    return {
        "id": data["id"],
        "subject": headers.get("Subject", ""),
        "from": headers.get("From", ""),
        "to": headers.get("To", ""),
        "date": headers.get("Date", ""),
        "body": body,
        "snippet": data.get("snippet", ""),
    }


@router.get("/status")
async def gmail_status():
    """Check if Gmail is connected."""
    return {"connected": "default" in _gmail_tokens}


async def _refresh_token(refresh_token: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "refresh_token": refresh_token,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
    if resp.status_code == 200:
        return resp.json()
    return None

