"""Kafka event consumer for the AI service.

Listens for events from other services and triggers AI workflows:
- file_uploaded → index document for RAG
- task_completed → notification + optional summary
- email_received → notification + AI summary option
"""

import json
from typing import Any


class EventConsumer:
    """Consumes events from Kafka and routes them to handlers."""

    def __init__(self):
        self._running = False
        self._handlers: dict[str, list] = {}

    def on(self, event_type: str, handler):
        """Register a handler for an event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def start(self, bootstrap_servers: str = "localhost:9092"):
        """Start consuming events from Kafka."""
        self._running = True

        try:
            from aiokafka import AIOKafkaConsumer
            consumer = AIOKafkaConsumer(
                "astra.files",
                "astra.tasks",
                "astra.emails",
                "astra.notifications",
                bootstrap_servers=bootstrap_servers,
                group_id="ai-service",
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            )
            await consumer.start()

            try:
                async for msg in consumer:
                    if not self._running:
                        break
                    await self._dispatch(msg.topic, msg.value)
            finally:
                await consumer.stop()
        except ImportError:
            print("aiokafka not installed - running without Kafka consumer")
        except Exception as e:
            print(f"Kafka consumer error: {e} - running without event consumption")

    async def stop(self):
        self._running = False

    async def _dispatch(self, topic: str, data: dict[str, Any]):
        """Dispatch event to registered handlers."""
        event_type = data.get("event_type", topic)
        handlers = self._handlers.get(event_type, [])
        for handler in handlers:
            try:
                await handler(data)
            except Exception as e:
                print(f"Event handler error for {event_type}: {e}")


# Event handlers

async def handle_file_uploaded(data: dict):
    """When a file is uploaded, index it for RAG."""
    from app.rag import rag_service

    file_id = data.get("file_id", "")
    user_id = data.get("user_id", "")
    content = data.get("content", "")
    file_type = data.get("mime_type", "")

    # Only index text-based files
    text_types = ["text/", "application/json", "application/javascript"]
    if any(t in file_type for t in text_types) and content:
        await rag_service.index_document(
            source_id=file_id,
            source_type="file",
            user_id=user_id,
            content=content,
            metadata={"mime_type": file_type},
        )


async def handle_email_received(data: dict):
    """When an email is received, optionally summarize."""
    from app.automation import automation_engine
    await automation_engine.trigger_event("email_received", data)


async def handle_task_completed(data: dict):
    """When a task is completed, trigger any automations."""
    from app.automation import automation_engine
    await automation_engine.trigger_event("task_completed", data)


# Singleton consumer with registered handlers
event_consumer = EventConsumer()
event_consumer.on("file_uploaded", handle_file_uploaded)
event_consumer.on("email_received", handle_email_received)
event_consumer.on("task_completed", handle_task_completed)
