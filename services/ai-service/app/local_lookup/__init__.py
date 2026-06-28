"""
Local data lookup layer.

Handles questions about the user's own data (files, tasks, notes, calendar, storage)
directly from Postgres — fast, free, no OpenAI API call.

Edit intent_router.py to add new intents.
Edit queries.py to add new database queries.
"""

from app.local_lookup.intent_router import route_message

__all__ = ["route_message"]
