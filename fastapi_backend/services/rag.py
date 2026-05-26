import asyncio
import re
from typing import List, Optional, Dict, Any
from google import genai
from config import get_settings
from services.database import get_pool
from services.embeddings import embed_query, to_pg_vector, get_gemini_client

class RetrievedChunk:
    def __init__(self, chunk_id: str, content: str, page_number: Optional[int], document_title: str, file_name: str, similarity: float):
        self.id = chunk_id
        self.content = content
        self.page_number = page_number
        self.document_title = document_title
        self.file_name = file_name
        self.similarity = similarity

async def retrieve_relevant_chunks(question: str, subject_id: Optional[str] = None, limit: int = 6) -> List[RetrievedChunk]:
    embedding_vals = await embed_query(question)
    embedding_str = to_pg_vector(embedding_vals)
    vector_literal = f"'{embedding_str}'::vector"
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        if subject_id:
            query = f"""
                SELECT
                    c."id",
                    c."content",
                    c."pageNumber" as "page_number",
                    d."title" AS "document_title",
                    d."fileName" as "file_name",
                    1 - (c."embedding" <=> {vector_literal}) AS "similarity"
                FROM "DocumentChunk" c
                JOIN "Document" d ON d."id" = c."documentId"
                WHERE c."embedding" IS NOT NULL AND d."subjectId" = $1
                ORDER BY c."embedding" <=> {vector_literal}
                LIMIT $2
            """
            rows = await conn.fetch(query, subject_id, limit)
        else:
            query = f"""
                SELECT
                    c."id",
                    c."content",
                    c."pageNumber" as "page_number",
                    d."title" AS "document_title",
                    d."fileName" as "file_name",
                    1 - (c."embedding" <=> {vector_literal}) AS "similarity"
                FROM "DocumentChunk" c
                JOIN "Document" d ON d."id" = c."documentId"
                WHERE c."embedding" IS NOT NULL
                ORDER BY c."embedding" <=> {vector_literal}
                LIMIT $1
            """
            rows = await conn.fetch(query, limit)
            
        vector_rows = [
            RetrievedChunk(
                chunk_id=r["id"],
                content=r["content"],
                page_number=r["page_number"],
                document_title=r["document_title"],
                file_name=r["file_name"],
                similarity=r["similarity"]
            )
            for r in rows
        ]
        
        if len(vector_rows) > 0:
            return vector_rows
            
        return await retrieve_by_keyword_fallback(question, subject_id, limit)

async def retrieve_by_keyword_fallback(question: str, subject_id: Optional[str], limit: int) -> List[RetrievedChunk]:
    tokens = set(
        token
        for token in re.split(r'[^a-z0-9]+', question.lower())
        if len(token) >= 3
    )
    
    pool = await get_pool()
    async with pool.acquire() as conn:
        if subject_id:
            query = """
                SELECT
                    c."id",
                    c."content",
                    c."pageNumber" as "page_number",
                    d."title" AS "document_title",
                    d."fileName" as "file_name"
                FROM "DocumentChunk" c
                JOIN "Document" d ON d."id" = c."documentId"
                WHERE d."subjectId" = $1
                ORDER BY c."createdAt" DESC
                LIMIT 100
            """
            rows = await conn.fetch(query, subject_id)
        else:
            query = """
                SELECT
                    c."id",
                    c."content",
                    c."pageNumber" as "page_number",
                    d."title" AS "document_title",
                    d."fileName" as "file_name"
                FROM "DocumentChunk" c
                JOIN "Document" d ON d."id" = c."documentId"
                ORDER BY c."createdAt" DESC
                LIMIT 100
            """
            rows = await conn.fetch(query)

        results = []
        for r in rows:
            content_lower = r["content"].lower()
            score = sum(1 for token in tokens if token in content_lower)
            similarity = score / max(len(tokens), 1)
            
            if similarity > 0 or len(tokens) == 0:
                results.append(
                    RetrievedChunk(
                        chunk_id=r["id"],
                        content=r["content"],
                        page_number=r["page_number"],
                        document_title=r["document_title"],
                        file_name=r["file_name"],
                        similarity=similarity
                    )
                )
                
        results.sort(key=lambda x: x.similarity, reverse=True)
        return results[:limit]

async def answer_from_slides(question: str, subject_id: Optional[str] = None) -> Dict[str, Any]:
    chunks = await retrieve_relevant_chunks(question, subject_id)
    
    if len(chunks) == 0:
        return {
            "answer": "I could not find enough reference material in the uploaded slides or notes for this question. Please upload or process the related material first.",
            "sources": []
        }
        
    context_parts = []
    for index, chunk in enumerate(chunks, start=1):
        page = f"page/slide {chunk.page_number}" if chunk.page_number else "page not available"
        context_parts.append(f"Source {index}: {chunk.document_title} ({page})\n{chunk.content}")
        
    context = "\n\n".join(context_parts)
    settings = get_settings()
    client = get_gemini_client()
    
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.models.generate_content(
            model=settings.gemini_chat_model,
            contents=f"Question:\n{question}\n\nUploaded material context:\n{context}",
            config={
                "temperature": 0.2,
                "system_instruction": "You are an exam preparation assistant for college students. Answer only from the provided uploaded slide/notes context. If the context is insufficient, clearly say that the uploaded material does not contain enough information. Use simple, student-friendly English. Include short source references by source number."
            }
        )
    )
    
    sources = [
        {
            "sourceNo": index,
            "documentTitle": chunk.document_title,
            "fileName": chunk.file_name,
            "pageNumber": chunk.page_number,
            "similarity": chunk.similarity
        }
        for index, chunk in enumerate(chunks, start=1)
    ]
    
    return {
        "answer": response.text or "The answer could not be generated.",
        "sources": sources
    }
