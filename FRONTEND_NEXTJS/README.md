# Exam Slides Preparation AI

MVP for a college PYQ and slides platform. Students can upload PYQs, slides, notes, and ask questions that are answered only from processed uploaded material.

## Stack

- Next.js full-stack app
- PostgreSQL with `pgvector`
- Prisma ORM
- AWS S3 for file storage
- Gemini embeddings + chat model for RAG

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill PostgreSQL, S3, and OpenAI values.

3. Enable pgvector in your PostgreSQL database, then run migration:

```bash
npm run prisma:migrate
```

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## How It Works

1. Upload PDF/PPTX/DOCX/TXT files.
2. File is stored in S3.
3. Text is extracted and split into chunks.
4. Each chunk gets an embedding and is stored in PostgreSQL.
5. When a student asks a question, the app retrieves similar chunks and asks the AI to answer only from those chunks.
6. Students can open uploaded files through S3 public URLs or short-lived signed URLs.

## Important Behavior

The AI prompt is intentionally strict:

- Use only uploaded slide/notes context.
- If context is not enough, say the uploaded material does not contain enough information.
- Give simple student-friendly answers.
- Include source numbers.
