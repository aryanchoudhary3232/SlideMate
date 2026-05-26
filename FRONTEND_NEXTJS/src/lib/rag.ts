import { prisma } from "@/lib/prisma";
import { embedQuery, getGeminiClient, toPgVector } from "@/lib/embeddings";

export type RetrievedChunk = {
  id: string;
  content: string;
  pageNumber: number | null;
  documentTitle: string;
  fileName: string;
  similarity: number;
};

export async function retrieveRelevantChunks(params: {
  question: string;
  subjectId?: string;
  limit?: number;
}) {
  const embedding = toPgVector(await embedQuery(params.question));
  const vectorLiteral = `'${embedding}'::vector`;
  const limit = params.limit || 6;
  let vectorRows: RetrievedChunk[];

  if (params.subjectId) {
    vectorRows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
      `
      SELECT
        c."id",
        c."content",
        c."pageNumber",
        d."title" AS "documentTitle",
        d."fileName",
        1 - (c."embedding" <=> ${vectorLiteral}) AS "similarity"
      FROM "DocumentChunk" c
      JOIN "Document" d ON d."id" = c."documentId"
      WHERE c."embedding" IS NOT NULL AND d."subjectId" = $1
      ORDER BY c."embedding" <=> ${vectorLiteral}
      LIMIT $2
      `,
      params.subjectId,
      limit
    );
  } else {
    vectorRows = await prisma.$queryRawUnsafe<RetrievedChunk[]>(
      `
      SELECT
        c."id",
        c."content",
        c."pageNumber",
        d."title" AS "documentTitle",
        d."fileName",
        1 - (c."embedding" <=> ${vectorLiteral}) AS "similarity"
      FROM "DocumentChunk" c
      JOIN "Document" d ON d."id" = c."documentId"
      WHERE c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> ${vectorLiteral}
      LIMIT $1
      `,
      limit
    );
  }

  if (vectorRows.length > 0) {
    return vectorRows;
  }

  return retrieveByKeywordFallback(params.question, params.subjectId, limit);
}

async function retrieveByKeywordFallback(
  question: string,
  subjectId: string | undefined,
  limit: number
) {
  const tokens = new Set(
    question
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length >= 3)
  );

  const chunks = await prisma.documentChunk.findMany({
    where: subjectId
      ? {
          document: { subjectId }
        }
      : undefined,
    include: {
      document: {
        select: {
          title: true,
          fileName: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return chunks
    .map((chunk) => {
      const content = chunk.content.toLowerCase();
      const score = Array.from(tokens).reduce(
        (total, token) => total + (content.includes(token) ? 1 : 0),
        0
      );

      return {
        id: chunk.id,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        documentTitle: chunk.document.title,
        fileName: chunk.document.fileName,
        similarity: score / Math.max(tokens.size, 1)
      };
    })
    .filter((chunk) => chunk.similarity > 0 || tokens.size === 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

export async function answerFromSlides(params: {
  question: string;
  subjectId?: string;
}) {
  const chunks = await retrieveRelevantChunks({
    question: params.question,
    subjectId: params.subjectId
  });

  if (chunks.length === 0) {
    return {
      answer:
        "I could not find enough reference material in the uploaded slides or notes for this question. Please upload or process the related material first.",
      sources: []
    };
  }

  const context = chunks
    .map((chunk, index) => {
      const page = chunk.pageNumber ? `page/slide ${chunk.pageNumber}` : "page not available";
      return `Source ${index + 1}: ${chunk.documentTitle} (${page})\n${chunk.content}`;
    })
    .join("\n\n");

  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
    contents: `Question:\n${params.question}\n\nUploaded material context:\n${context}`,
    config: {
      temperature: 0.2,
      systemInstruction:
        "You are an exam preparation assistant for college students. Answer only from the provided uploaded slide/notes context. If the context is insufficient, clearly say that the uploaded material does not contain enough information. Use simple, student-friendly English. Include short source references by source number."
    }
  });

  return {
    answer: response.text || "The answer could not be generated.",
    sources: chunks.map((chunk, index) => ({
      sourceNo: index + 1,
      documentTitle: chunk.documentTitle,
      fileName: chunk.fileName,
      pageNumber: chunk.pageNumber,
      similarity: chunk.similarity
    }))
  };
}
