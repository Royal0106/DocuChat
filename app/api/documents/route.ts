import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chats, documents } from "@/db/schema";
import { ingestDocument } from "@/lib/documents/ingest";
import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES, type SupportedMimeType } from "@/lib/documents/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function resolveMimeType(file: File): SupportedMimeType | null {
  const name = file.name.toLowerCase();
  if (file.type && ACCEPTED_MIME_TYPES[file.type]) {
    return ACCEPTED_MIME_TYPES[file.type];
  }
  // Browsers send inconsistent (or empty) MIME types for .md/.markdown files.
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".pdf")) return "application/pdf";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
    }

    const file = formData.get("file");
    const chatIdField = formData.get("chatId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }

    const mimeType = resolveMimeType(file);
    if (!mimeType) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, TXT, or Markdown file." },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large. The maximum upload size is ${Math.round(
            MAX_UPLOAD_BYTES / (1024 * 1024),
          )} MB.`,
        },
        { status: 400 },
      );
    }

    let chatId = typeof chatIdField === "string" && chatIdField.length > 0 ? chatIdField : null;

    if (chatId) {
      const existing = await db.query.chats.findFirst({ where: eq(chats.id, chatId) });
      if (!existing) {
        return NextResponse.json({ error: "Chat not found." }, { status: 404 });
      }
    } else {
      const [newChat] = await db.insert(chats).values({}).returning();
      chatId = newChat.id;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const [document] = await db
      .insert(documents)
      .values({
        chatId,
        filename: file.name,
        mimeType,
        fileSize: file.size,
        status: "uploading",
      })
      .returning();

    await ingestDocument(document.id, buffer, mimeType);

    const finalDocument = await db.query.documents.findFirst({
      where: eq(documents.id, document.id),
    });

    return NextResponse.json({ chatId, document: finalDocument });
  } catch (error) {
    console.error("Document upload failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while processing your upload. Please try again." },
      { status: 500 },
    );
  }
}
