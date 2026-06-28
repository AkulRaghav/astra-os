"""
Database queries for local data lookups.

All queries are scoped to the requesting user_id.
Returns formatted natural-language strings ready to show the user.

File: services/ai-service/app/local_lookup/queries.py
"""

import asyncpg
from datetime import datetime, timedelta

from app.config import settings

_pool = None


async def _get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=5)
    return _pool


def _format_bytes(b: int) -> str:
    if b == 0:
        return "0 B"
    gb = b / (1024 ** 3)
    if gb >= 1:
        return f"{gb:.2f} GB"
    mb = b / (1024 ** 2)
    if mb >= 1:
        return f"{mb:.1f} MB"
    kb = b / 1024
    return f"{kb:.1f} KB"


async def query_file_count(user_id: str) -> str:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT COUNT(*) as cnt FROM files WHERE owner_id = $1 AND is_trashed = false",
        user_id,
    )
    count = row["cnt"] if row else 0
    if count == 0:
        return "You have no files in your workspace yet."
    return f"You have **{count}** file{'s' if count != 1 else ''} in your workspace."


async def query_storage_usage(user_id: str) -> str:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT COALESCE(SUM(size), 0) as used FROM files WHERE owner_id = $1 AND is_trashed = false",
        user_id,
    )
    used = row["used"] if row else 0
    total = 5 * 1024 * 1024 * 1024  # 5 GB default (free tier)

    # Try to get actual plan limit
    plan_row = await pool.fetchrow(
        """SELECT bp.limits->>'storageGb' as storage_gb FROM users u
           LEFT JOIN billing_info bi ON bi.user_id = u.id
           LEFT JOIN billing_plans bp ON bp.id = bi.plan_id
           WHERE u.id = $1""",
        user_id,
    )
    if plan_row and plan_row["storage_gb"]:
        try:
            gb = int(plan_row["storage_gb"])
            if gb > 0:
                total = gb * 1024 * 1024 * 1024
        except (ValueError, TypeError):
            pass

    pct = (used / total * 100) if total > 0 else 0
    return f"You're using **{_format_bytes(used)}** of **{_format_bytes(total)}** ({pct:.1f}% used)."


async def query_tasks_today(user_id: str) -> str:
    pool = await _get_pool()
    rows = await pool.fetch(
        """SELECT title, status, priority FROM tasks
           WHERE owner_id = $1 AND status != 'done' AND status != 'cancelled'
           ORDER BY priority DESC, created_at DESC LIMIT 10""",
        user_id,
    )
    if not rows:
        return "You have no pending tasks right now. Everything's done! ✓"

    lines = [f"You have **{len(rows)}** pending task{'s' if len(rows) != 1 else ''}:\n"]
    for r in rows:
        status_icon = "🔵" if r["status"] == "in_progress" else "⬜"
        lines.append(f"{status_icon} {r['title']} ({r['priority']} priority, {r['status']})")
    return "\n".join(lines)


async def query_tasks_by_status(user_id: str) -> str:
    pool = await _get_pool()
    rows = await pool.fetch(
        """SELECT status, COUNT(*) as cnt FROM tasks
           WHERE owner_id = $1 GROUP BY status""",
        user_id,
    )
    if not rows:
        return "You have no tasks yet."

    total = sum(r["cnt"] for r in rows)
    parts = []
    for r in rows:
        parts.append(f"{r['status']}: {r['cnt']}")
    return f"You have **{total}** total tasks — {', '.join(parts)}."


async def query_recent_files(user_id: str) -> str:
    pool = await _get_pool()
    rows = await pool.fetch(
        """SELECT name, size, updated_at FROM files
           WHERE owner_id = $1 AND is_trashed = false
           ORDER BY updated_at DESC LIMIT 5""",
        user_id,
    )
    if not rows:
        return "You haven't created or edited any files yet."

    lines = ["Your most recently modified files:\n"]
    for r in rows:
        when = r["updated_at"].strftime("%b %d, %H:%M") if r["updated_at"] else "unknown"
        lines.append(f"• **{r['name']}** ({_format_bytes(r['size'])}) — {when}")
    return "\n".join(lines)


async def query_recent_notes(user_id: str) -> str:
    pool = await _get_pool()
    rows = await pool.fetch(
        """SELECT title, updated_at FROM notes
           WHERE owner_id = $1 AND is_archived = false
           ORDER BY updated_at DESC LIMIT 5""",
        user_id,
    )
    if not rows:
        return "You don't have any notes yet. Create one from the Notes tab."

    lines = ["Your recent notes:\n"]
    for r in rows:
        when = r["updated_at"].strftime("%b %d, %H:%M") if r["updated_at"] else ""
        lines.append(f"• **{r['title']}** — {when}")
    return "\n".join(lines)


async def query_note_count(user_id: str) -> str:
    pool = await _get_pool()
    row = await pool.fetchrow(
        "SELECT COUNT(*) as cnt FROM notes WHERE owner_id = $1 AND is_archived = false",
        user_id,
    )
    count = row["cnt"] if row else 0
    if count == 0:
        return "You have no notes yet."
    return f"You have **{count}** note{'s' if count != 1 else ''}."


async def query_calendar_this_week(user_id: str) -> str:
    pool = await _get_pool()
    now = datetime.now()
    week_end = now + timedelta(days=7)
    rows = await pool.fetch(
        """SELECT title, start_time, end_time, location FROM calendar_events
           WHERE owner_id = $1 AND start_time >= $2 AND start_time <= $3
           ORDER BY start_time ASC LIMIT 10""",
        user_id, now, week_end,
    )
    if not rows:
        return "You have no events scheduled this week."

    lines = [f"You have **{len(rows)}** event{'s' if len(rows) != 1 else ''} this week:\n"]
    for r in rows:
        day = r["start_time"].strftime("%A %b %d, %I:%M %p") if r["start_time"] else ""
        loc = f" @ {r['location']}" if r.get("location") else ""
        lines.append(f"• **{r['title']}** — {day}{loc}")
    return "\n".join(lines)
