import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const fastapiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${fastapiUrl}/api/documents/${id}/download`);

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: errText || "Download URL failed" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download URL failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

