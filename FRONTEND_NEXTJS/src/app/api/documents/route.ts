import { NextResponse } from "next/server";

export async function GET() {
  try {
    const fastapiUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${fastapiUrl}/api/documents`, { cache: "no-store" });
    
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch from FastAPI documents" }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Documents list failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

