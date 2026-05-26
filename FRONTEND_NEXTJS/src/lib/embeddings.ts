import { GoogleGenAI } from "@google/genai";

let cachedGemini: GoogleGenAI | null = null;

export function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for AI features");
  }

  if (!cachedGemini) {
    cachedGemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  return cachedGemini;
}

export async function embedDocument(text: string, title = "none") {
  return embedText(`title: ${title || "none"} | text: ${text}`);
}

export async function embedQuery(text: string) {
  return embedText(`task: question answering | query: ${text}`);
}

async function embedText(text: string) {
  const client = getGeminiClient();
  const response = await client.models.embedContent({
    model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
    contents: text,
    config: { outputDimensionality: 1536 }
  });

  const values = response.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Gemini did not return an embedding.");
  }

  return values;
}

export function toPgVector(values: number[]) {
  return `[${values.join(",")}]`;
}
