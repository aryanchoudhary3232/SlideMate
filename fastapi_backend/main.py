import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from services.database import get_pool, close_pool
from routers import ask, ingest, documents

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fastapi_backend")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize the DB connection pool
    logger.info("Starting up FastAPI application...")
    try:
        await get_pool()
        logger.info("PostgreSQL database pool initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize PostgreSQL pool: {e}")
        
    yield
    
    # Shutdown: Close the DB connection pool
    logger.info("Shutting down FastAPI application...")
    await close_pool()
    logger.info("PostgreSQL database pool closed.")

app = FastAPI(
    title="Exam Slides Preparation AI Backend",
    description="Python FastAPI backend serving document chunking, embeddings, and RAG pipelines for AI-powered slide preparation.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware setup
settings = get_settings()
origins = [
    settings.nextjs_url,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(ask.router)
app.include_router(ingest.router)
app.include_router(documents.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "fastapi_backend"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.fastapi_port, reload=True)
