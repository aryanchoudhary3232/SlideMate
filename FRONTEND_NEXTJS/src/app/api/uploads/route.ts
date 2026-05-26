import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";
// Ingest triggered via FastAPI backend


export const runtime = "nodejs";

const uploadSchema = z.object({
  title: z.string().min(2),
  documentType: z.enum(["PYQ", "SLIDE", "NOTE"]),
  subjectName: z.string().min(2),
  branch: z.string().min(1),
  semester: z.string().min(1),
  year: z.string().optional(),
  uploaderName: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const values = uploadSchema.parse({
      title: formData.get("title"),
      documentType: formData.get("documentType"),
      subjectName: formData.get("subjectName"),
      branch: formData.get("branch"),
      semester: formData.get("semester"),
      year: formData.get("year") || undefined,
      uploaderName: formData.get("uploaderName") || undefined
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split(".").pop() || "bin";
    const key = `uploads/${values.branch}/${values.semester}/${randomUUID()}.${extension}`;
    await uploadToS3({
      buffer,
      key,
      contentType: file.type || "application/octet-stream"
    });

    const subject = await prisma.subject.upsert({
      where: {
        name_branch_semester: {
          name: values.subjectName.trim(),
          branch: values.branch.trim(),
          semester: values.semester.trim()
        }
      },
      update: {},
      create: {
        name: values.subjectName.trim(),
        branch: values.branch.trim(),
        semester: values.semester.trim()
      }
    });

    const document = await prisma.document.create({
      data: {
        title: values.title.trim(),
        type: values.documentType,
        storageKey: key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: buffer.length,
        uploaderName: values.uploaderName?.trim(),
        year: values.year?.trim(),
        subjectId: subject.id
      },
      include: { subject: true }
    });

    let ingestResult: any = null;
    if (process.env.PROCESS_DOCUMENTS_ON_UPLOAD !== "false") {
      try {
        const fastapiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
        const ingestResponse = await fetch(`${fastapiUrl}/api/ingest/${document.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            document_id: document.id,
            storage_key: key,
            mime_type: document.mimeType,
            file_name: document.fileName
          })
        });
        if (ingestResponse.ok) {
          ingestResult = await ingestResponse.json();
        } else {
          console.error("FastAPI Ingest failed:", await ingestResponse.text());
        }
      } catch (err) {
        console.error("Failed to trigger FastAPI Ingest:", err);
      }
    }

    return NextResponse.json({ document, ingestResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
