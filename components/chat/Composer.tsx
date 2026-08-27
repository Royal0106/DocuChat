"use client";

import { useState, type KeyboardEvent } from "react";
import { FileUploadButton } from "./FileUploadButton";

interface ComposerProps {
  chatId: string | null;
  documentReady: boolean;
  isUploading: boolean;
  isBusy: boolean;
  onFile: (file: File) => void;
  onUploadError: (message: string) => void;
  onSend: (text: string) => void;
}

export function Composer({
  documentReady,
  isUploading,
  isBusy,
  onFile,
  onUploadError,
  onSend,
}: ComposerProps) {
  const [text, setText] = useState("");

  const canSend = documentReady && !isBusy && !isUploading && text.trim().length > 0;

  function submit() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const placeholder = isUploading
    ? "Processing your document…"
    : documentReady
      ? "Ask a question about your document…"
      : "Attach a PDF, TXT, or Markdown file to get started…";

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <FileUploadButton
        onFileSelected={onFile}
        onValidationError={onUploadError}
        disabled={isUploading || isBusy}
      />
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!documentReady || isBusy || isUploading}
        placeholder={placeholder}
        rows={1}
        aria-label="Message"
        className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none disabled:cursor-not-allowed dark:text-neutral-100 dark:placeholder:text-neutral-500"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
