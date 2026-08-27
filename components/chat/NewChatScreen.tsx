"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument, validateFileClientSide } from "@/lib/chat/upload-client";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/types";

export function NewChatScreen() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const validationError = validateFileClientSide(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const result = await uploadDocument(file, null);
      router.push(`/chat/${result.chatId}`);
    } catch (err) {
      setIsUploading(false);
      setError(err instanceof Error ? err.message : "Failed to upload the document.");
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Document Chat</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
        Upload a PDF, TXT, or Markdown document and ask questions about it. Answers are grounded in
        your document with citations back to the source.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`mt-8 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-colors ${
          isDragging
            ? "border-neutral-500 bg-neutral-50 dark:bg-neutral-900"
            : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
          className="hidden"
          disabled={isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {isUploading ? "Uploading and indexing…" : "Upload a document"}
        </button>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          or drag and drop · PDF, TXT, or Markdown · up to {Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}{" "}
          MB
        </p>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
