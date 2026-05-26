import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const askSchema = z.object({
  question: z.string().min(5),
  subjectId: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = askSchema.parse(await request.json());
    const fastapiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    
    const response = await fetch(`${fastapiUrl}/api/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: body.question,
        subject_id: body.subjectId || null
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: errText || "FastAPI answer failed" }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI answer failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

