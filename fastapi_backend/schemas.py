from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class DocumentType(str, Enum):
    PYQ = "PYQ"
    SLIDE = "SLIDE"
    NOTE = "NOTE"


class DocumentStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


# ─── Ask / RAG ───────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str
    subject_id: Optional[str] = None


class SourceReference(BaseModel):
    source_no: int
    document_title: str
    file_name: str
    page_number: Optional[int] = None
    similarity: float


class AskResponse(BaseModel):
    answer: str
    sources: List[SourceReference]


# ─── Document ────────────────────────────────────────────────
class SubjectInfo(BaseModel):
    id: str
    name: str
    branch: str
    semester: str


class DocumentInfo(BaseModel):
    id: str
    title: str
    type: DocumentType
    status: DocumentStatus
    file_name: str
    mime_type: str
    size: int
    storage_key: str
    uploader_name: Optional[str] = None
    year: Optional[str] = None
    error_message: Optional[str] = None
    subject: SubjectInfo


class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]
    total: int


# ─── Ingest ──────────────────────────────────────────────────
class IngestResponse(BaseModel):
    document_id: str
    chunks: int
    status: str


# ─── Upload (called from Next.js) ────────────────────────────
class UploadMetadata(BaseModel):
    title: str
    document_type: DocumentType
    subject_name: str
    branch: str
    semester: str
    year: Optional[str] = None
    uploader_name: Optional[str] = None
