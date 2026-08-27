import type { DocumentRow } from "@/db/schema";
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/documents/types";

export interface UploadDocumentResult {
  chatId: string;
  document: DocumentRow;
}

export function validateFileClientSide(file: File): string | null {
  const name = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!hasAcceptedExtension) {
    return "Unsupported file type. Please upload a PDF, TXT, or Markdown file.";
  }
  if (file.size === 0) {
    return "The selected file is empty.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large. The maximum upload size is ${Math.round(
      MAX_UPLOAD_BYTES / (1024 * 1024),
    )} MB.`;
  }
  return null;
}

export async function uploadDocument(
  file: File,
  chatId: string | null,
): Promise<UploadDocumentResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (chatId) formData.append("chatId", chatId);

  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error ?? "Failed to upload the document. Please try again.");
  }

  return body as UploadDocumentResult;
}
