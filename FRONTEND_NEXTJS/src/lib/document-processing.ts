import JSZip from "jszip";

export type ExtractedPage = {
  pageNumber?: number;
  text: string;
};

export async function extractTextFromBuffer(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ExtractedPage[]> {
  const fileName = params.fileName.toLowerCase();

  if (params.mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(params.buffer);
    return [{ text: normalizeText(parsed.text) }];
  }

  if (
    params.mimeType.includes("wordprocessingml") ||
    fileName.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: params.buffer });
    return [{ text: normalizeText(result.value) }];
  }

  if (
    params.mimeType.includes("presentationml") ||
    fileName.endsWith(".pptx")
  ) {
    return extractPptxText(params.buffer);
  }

  if (params.mimeType.startsWith("text/") || fileName.endsWith(".txt")) {
    return [{ text: normalizeText(params.buffer.toString("utf8")) }];
  }

  throw new Error("Unsupported file type. Upload PDF, PPTX, DOCX, or TXT.");
}

export function chunkExtractedPages(pages: ExtractedPage[]) {
  const chunks: Array<{ content: string; pageNumber?: number; chunkIndex: number }> = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const words = page.text.split(/\s+/).filter(Boolean);
    const size = 650;
    const overlap = 90;

    for (let start = 0; start < words.length; start += size - overlap) {
      const content = sanitizeTextForStorage(words.slice(start, start + size).join(" "));
      if (content.length < 40) continue;

      chunks.push({
        content,
        pageNumber: page.pageNumber,
        chunkIndex
      });
      chunkIndex += 1;
    }
  }

  return chunks;
}

async function extractPptxText(buffer: Buffer): Promise<ExtractedPage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => getSlideNumber(a) - getSlideNumber(b));

  const pages: ExtractedPage[] = [];

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async("string");
    const text = Array.from(xml.matchAll(/<a:t>(.*?)<\/a:t>/g))
      .map((match) => decodeXml(match[1]))
      .join(" ");

    pages.push({
      pageNumber: getSlideNumber(slidePath),
      text: normalizeText(text)
    });
  }

  return pages;
}

function getSlideNumber(path: string) {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] || 0);
}

export function sanitizeTextForStorage(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text: string) {
  return sanitizeTextForStorage(text);
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}
