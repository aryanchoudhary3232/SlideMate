from fastapi import APIRouter, HTTPException
from schemas import AskRequest, AskResponse
from services.rag import answer_from_slides

router = APIRouter(prefix="/api/ask", tags=["Ask"])

@router.post("", response_model=AskResponse)
async def ask_question(body: AskRequest):
    try:
        result = await answer_from_slides(
            question=body.question,
            subject_id=body.subject_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
