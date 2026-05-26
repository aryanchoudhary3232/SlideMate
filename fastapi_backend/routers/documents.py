from fastapi import APIRouter, HTTPException
from services.database import get_pool
from services.s3 import generate_presigned_url
from typing import Dict, Any

router = APIRouter(prefix="/api/documents", tags=["Documents"])

@router.get("")
async def list_documents_and_subjects() -> Dict[str, Any]:
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        # 1. Fetch subjects
        subject_rows = await conn.fetch(
            """
            SELECT "id", "name", "branch", "semester"
            FROM "Subject"
            ORDER BY "branch" ASC, "semester" ASC, "name" ASC
            """
        )
        subjects = [dict(r) for r in subject_rows]
        
        # 2. Fetch documents
        document_rows = await conn.fetch(
            """
            SELECT 
                d."id", d."title", d."type", d."status", d."fileName" as "fileName", 
                d."mimeType" as "mimeType", d."size", d."storageKey" as "storageKey", 
                d."uploaderName" as "uploaderName", d."year", d."errorMessage" as "errorMessage",
                d."createdAt" as "createdAt",
                s."id" as "subject_id", s."name" as "subject_name", 
                s."branch" as "subject_branch", s."semester" as "subject_semester",
                (SELECT COUNT(*)::int FROM "DocumentChunk" c WHERE c."documentId" = d."id") as "chunk_count"
            FROM "Document" d
            JOIN "Subject" s ON d."subjectId" = s."id"
            ORDER BY d."createdAt" DESC
            LIMIT 50
            """
        )
        
        documents = []
        for r in document_rows:
            doc = {
                "id": r["id"],
                "title": r["title"],
                "type": r["type"],
                "status": r["status"],
                "fileName": r["fileName"],
                "mimeType": r["mimeType"],
                "size": r["size"],
                "storageKey": r["storageKey"],
                "uploaderName": r["uploaderName"],
                "year": r["year"],
                "errorMessage": r["errorMessage"],
                "createdAt": r["createdAt"].isoformat() if r["createdAt"] else None,
                "subject": {
                    "id": r["subject_id"],
                    "name": r["subject_name"],
                    "branch": r["subject_branch"],
                    "semester": r["subject_semester"]
                },
                "_count": {
                    "chunks": r["chunk_count"]
                }
            }
            documents.append(doc)
            
    return {"subjects": subjects, "documents": documents}

@router.get("/{document_id}/download")
async def get_document_download_url(document_id: str) -> Dict[str, str]:
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT "storageKey" FROM "Document" WHERE "id" = $1',
            document_id
        )
        
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
        
    try:
        url = generate_presigned_url(row["storageKey"])
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
