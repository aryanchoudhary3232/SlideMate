import { prisma } from "@/lib/prisma";
import {
  extractTextFromBuffer,
  chunkExtractedPages,
  sanitizeTextForStorage
} from "@/lib/document-processing";
import { embedDocument, toPgVector } from "@/lib/embeddings";

export async function ingestDocumentBuffer(params: {
  documentId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}) {
  await prisma.document.update({
    where: { id: params.documentId },
    data: { status: "PROCESSING", errorMessage: null }
  });

  try {
    const pages = await extractTextFromBuffer(params);
    const chunks = chunkExtractedPages(pages);

    if (chunks.length === 0) {
      throw new Error("No readable text found in this document.");
    }

    await prisma.documentChunk.deleteMany({
      where: { documentId: params.documentId }
    });

    for (const chunk of chunks) {
      const safeContent = sanitizeTextForStorage(chunk.content);
      const embedding = process.env.GEMINI_API_KEY
        ? toPgVector(await embedDocument(safeContent, params.fileName))
        : null;

      if (embedding) {
        await prisma.$executeRaw`
          INSERT INTO "DocumentChunk" ("id", "documentId", "content", "pageNumber", "chunkIndex", "embedding", "createdAt")
          VALUES (gen_random_uuid()::text, ${params.documentId}, ${safeContent}, ${chunk.pageNumber ?? null}, ${chunk.chunkIndex}, ${embedding}::vector, NOW())
        `;
      } else {
        await prisma.documentChunk.create({
          data: {
            documentId: params.documentId,
            content: safeContent,
            pageNumber: chunk.pageNumber,
            chunkIndex: chunk.chunkIndex
          }
        });
      }
    }

    await prisma.document.update({
      where: { id: params.documentId },
      data: { status: "PROCESSED" }
    });

    return { chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed";
    await prisma.document.update({
      where: { id: params.documentId },
      data: { status: "FAILED", errorMessage: message }
    });
    throw error;
  }
}
