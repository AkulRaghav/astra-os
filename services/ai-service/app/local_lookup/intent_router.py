"""
Intent classification and routing for local data lookups.

Approach: keyword/pattern matching. Chosen because:
- Zero latency (no API call for classification)
- Deterministic and debuggable
- Easy to extend: just add patterns to INTENTS below
- Falls through to OpenAI for anything that doesn't match

To add a new intent:
1. Add an entry to INTENTS with keywords and a handler name
2. Implement the handler in queries.py

File: services/ai-service/app/local_lookup/intent_router.py
"""

import re
from app.local_lookup.queries import (
    query_file_count,
    query_storage_usage,
    query_tasks_today,
    query_tasks_by_status,
    query_recent_files,
    query_recent_notes,
    query_calendar_this_week,
    query_note_count,
)

# Each intent: list of keyword patterns (any match triggers), handler function
INTENTS = [
    {
        "name": "file_count",
        "patterns": [
            r"\bhow many files\b",
            r"\bfile count\b",
            r"\bnumber of files\b",
            r"\btotal files\b",
        ],
        "handler": query_file_count,
    },
    {
        "name": "storage_usage",
        "patterns": [
            r"\bstorage\b.*\b(usage|used|space|quota|how much)\b",
            r"\bhow much (storage|space|disk)\b",
            r"\bmy storage\b",
            r"\bstorage usage\b",
        ],
        "handler": query_storage_usage,
    },
    {
        "name": "tasks_today",
        "patterns": [
            r"\btasks?\b.*\btoday\b",
            r"\btoday.{0,20}tasks?\b",
            r"\bwhat.{0,15}(to do|todo)\b",
            r"\bpending tasks\b",
            r"\bincomplete tasks\b",
            r"\bstill to do\b",
        ],
        "handler": query_tasks_today,
    },
    {
        "name": "tasks_by_status",
        "patterns": [
            r"\bhow many tasks\b",
            r"\btask count\b",
            r"\btasks.{0,10}(in progress|done|completed)\b",
        ],
        "handler": query_tasks_by_status,
    },
    {
        "name": "recent_files",
        "patterns": [
            r"\brecent(ly)?\b.*\b(files?|edited|modified|changed)\b",
            r"\bwhat did i (edit|modify|change|update)\b",
            r"\blast (edited|modified|updated) files\b",
        ],
        "handler": query_recent_files,
    },
    {
        "name": "recent_notes",
        "patterns": [
            r"\brecent(ly)?\b.*\bnotes?\b",
            r"\blast notes\b",
            r"\bmy notes\b",
        ],
        "handler": query_recent_notes,
    },
    {
        "name": "note_count",
        "patterns": [
            r"\bhow many notes\b",
            r"\bnote count\b",
            r"\bnumber of notes\b",
        ],
        "handler": query_note_count,
    },
    {
        "name": "calendar_this_week",
        "patterns": [
            r"\bcalendar\b.*\b(this week|today|upcoming|next)\b",
            r"\bwhat.{0,15}(meeting|event|schedule|on my calendar)\b",
            r"\bwhen is my\b",
            r"\bevents? this week\b",
            r"\bupcoming events?\b",
        ],
        "handler": query_calendar_this_week,
    },
]


async def route_message(message: str, user_id: str) -> str | None:
    """
    Check if a message matches a local-lookup intent.

    Returns:
        A formatted answer string if a local intent matched, or None to fall through to OpenAI.
    """
    if not message or not user_id or user_id in ("anonymous", "current", ""):
        return None

    msg_lower = message.lower().strip()

    # Skip if clearly a coding/general question (fast rejection)
    coding_signals = [
        r"^(write|create|generate|build|make|code|implement|show me)\b.*(function|class|script|program|code|app|api)",
        r"\b(explain|how does|what is|define|difference between)\b",
        r"\b(python|javascript|go|rust|typescript|java|c\+\+|html|css|sql|react|node)\b.*\b(code|function|example|syntax)\b",
        r"```",
    ]
    for pattern in coding_signals:
        if re.search(pattern, msg_lower):
            return None  # Let OpenAI handle it

    # Check local intents
    for intent in INTENTS:
        for pattern in intent["patterns"]:
            if re.search(pattern, msg_lower):
                try:
                    result = await intent["handler"](user_id)
                    return result
                except Exception as e:
                    # On query failure, fall through to OpenAI rather than showing an error
                    print(f"Local lookup failed for intent '{intent['name']}': {e}")
                    return None

    return None  # No match, fall through to OpenAI
