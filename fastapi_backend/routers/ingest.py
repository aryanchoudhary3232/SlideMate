import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.database import get_pool
from services.s3 import get_s3_client
from services.document_processing import extract_text_from_buffer, chunk_extracted_pages, sanitize_text_for_storage
from services.embeddings import embed_document, to_pg_vector
from config import get_settings
import uuid

router = APIRouter(prefix="/api/ingest", tags=["Ingest"])

logger = logging.getLogger("fastapi_backend")

class IngestRequest(BaseModel):
    document_id: str
    storage_key: str
    mime_type: str
    file_name: str

@router.post("/{document_id}")
async def ingest_document(document_id: str, body: IngestRequest):
    settings = get_settings()
    pool = await get_pool()
    
    # 1. Update status to PROCESSING
    async with pool.acquire() as conn:
        await conn.execute(
            'UPDATE "Document" SET "status" = $1, "errorMessage" = NULL WHERE "id" = $2',
            "PROCESSING", document_id
        )
        
    try:
        # 2. Fetch file buffer from S3
        s3 = get_s3_client()
        response = s3.get_object(Bucket=settings.s3_bucket_name, Key=body.storage_key)
        buffer = response["Body"].read()
        
        # 3. Extract text
        pages = extract_text_from_buffer(
            buffer=buffer,
            mime_type=body.mime_type,
            file_name=body.file_name
        )
        
        chunks = chunk_extracted_pages(pages)
        if len(chunks) == 0:
            raise ValueError("No readable text found in this document.")
            
        async with pool.acquire() as conn:
            # 4. Clean up any existing chunks
            await conn.execute('DELETE FROM "DocumentChunk" WHERE "documentId" = $1', document_id)
            
            # 5. Process and insert chunks
            for chunk in chunks:
                safe_content = sanitize_text_for_storage(chunk["content"])
                
                embedding = None
                if settings.gemini_api_key:
                    embedding_vals = await embed_document(safe_content, body.file_name)
                    embedding = to_pg_vector(embedding_vals)
                
                chunk_id = str(uuid.uuid4())
                page_num = chunk["page_number"]
                chunk_index = chunk["chunk_index"]
                
                if embedding:
                    # Insert with embedding
                    await conn.execute(
                        """
                        INSERT INTO "DocumentChunk" ("id", "documentId", "content", "pageNumber", "chunkIndex", "embedding", "createdAt")
                        VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
                        """,
                        chunk_id, document_id, safe_content, page_num, chunk_index, embedding
                    )
                else:
                    # Insert without embedding
                    await conn.execute(
                        """
                        INSERT INTO "DocumentChunk" ("id", "documentId", "content", "pageNumber", "chunkIndex", "createdAt")
                        VALUES ($1, $2, $3, $4, $5, NOW())
                        """,
                        chunk_id, document_id, safe_content, page_num, chunk_index
                    )
            
            # 6. Update status to PROCESSED
            await conn.execute(
                'UPDATE "Document" SET "status" = $1 WHERE "id" = $2',
                "PROCESSED", document_id
            )
            
        return {"document_id": document_id, "chunks": len(chunks), "status": "PROCESSED"}
        
    except Exception as e:
        logger.error(f"Failed to ingest document {document_id}: {str(e)}")
        # Update status to FAILED with error message
        async with pool.acquire() as conn:
            await conn.execute(
                'UPDATE "Document" SET "status" = $1, "errorMessage" = $2 WHERE "id" = $3',
                "FAILED", str(e), document_id
            )
        raise HTTPException(status_code=500, detail=str(e))
