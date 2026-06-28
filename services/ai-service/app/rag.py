"""RAG (Retrieval-Augmented Generation) module.

Handles document embedding, storage in pgvector, and semantic search
for AI context retrieval.
"""

from dataclasses import dataclass

from app.config import settings
from app.llm import get_embedding, get_embeddings_batch


@dataclass
class SearchResult:
    id: str
    content: str
    source: str
    score: float
    metadata: dict


class RAGService:
    """Manages document embeddings and semantic search."""

    def __init__(self):
        self._pool = None

    async def _get_pool(self):
        if self._pool is None:
            import asyncpg
            self._pool = await asyncpg.create_pool(settings.vector_db_url, min_size=2, max_size=10)
        return self._pool

    async def index_document(
        self,
        source_id: str,
        source_type: str,
        user_id: str,
        content: str,
        metadata: dict | None = None,
    ) -> None:
        """Split document into chunks and store embeddings."""
        chunks = self._chunk_text(content)
        if not chunks:
            return

        embeddings = await get_embeddings_batch(chunks)
        pool = await self._get_pool()

        async with pool.acquire() as conn:
            for chunk, embedding in zip(chunks, embeddings):
                await conn.execute(
                    """INSERT INTO document_embeddings 
                       (id, source_id, source_type, user_id, content_chunk, embedding, metadata)
                       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)""",
                    source_id, source_type, user_id, chunk,
                    str(embedding), metadata or {},
                )

    async def search(
        self,
        query: str,
        user_id: str,
        limit: int = 5,
        min_score: float = 0.7,
    ) -> list[SearchResult]:
        """Semantic search across user's documents."""
        query_embedding = await get_embedding(query)
        pool = await self._get_pool()

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, content_chunk, source_type, metadata,
                          1 - (embedding <=> $1::vector) as score
                   FROM document_embeddings
                   WHERE user_id = $2
                     AND 1 - (embedding <=> $1::vector) >= $3
                   ORDER BY embedding <=> $1::vector
                   LIMIT $4""",
                str(query_embedding), user_id, min_score, limit,
            )

        return [
            SearchResult(
                id=str(row["id"]),
                content=row["content_chunk"],
                source=row["source_type"],
                score=float(row["score"]),
                metadata=row["metadata"] or {},
            )
            for row in rows
        ]

    async def delete_document(self, source_id: str) -> None:
        """Remove all embeddings for a document."""
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM document_embeddings WHERE source_id = $1", source_id
            )

    def _chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
        """Split text into overlapping chunks."""
        if not text or len(text) < 50:
            return [text] if text else []

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start = end - overlap

        return chunks


# Singleton
rag_service = RAGService()
