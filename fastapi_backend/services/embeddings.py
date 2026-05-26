from functools import lru_cache
from typing import List
from google import genai
from config import get_settings


@lru_cache()
def get_gemini_client() -> genai.Client:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is required for AI features")
    return genai.Client(api_key=settings.gemini_api_key)


def to_pg_vector(values: List[float]) -> str:
    """Convert float list to PostgreSQL vector literal string."""
    return "[" + ",".join(str(v) for v in values) + "]"


async def embed_document(text: str, title: str = "none") -> List[float]:
    return await _embed_text(f"title: {title or 'none'} | text: {text}")


async def embed_query(text: str) -> List[float]:
    return await _embed_text(f"task: question answering | query: {text}")


async def _embed_text(text: str) -> List[float]:
    import asyncio
    settings = get_settings()
    client = get_gemini_client()

    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.models.embed_content(
            model=settings.gemini_embedding_model,
            contents=text,
            config={"output_dimensionality": 1536},
        ),
    )

    values = response.embeddings[0].values if response.embeddings else None
    if not values:
        raise ValueError("Gemini did not return an embedding.")
    return list(values)
