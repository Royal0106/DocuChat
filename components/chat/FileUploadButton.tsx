"use client";

import { useRef } from "react";
import { validateFileClientSide } from "@/lib/chat/upload-client";

interface FileUploadButtonProps {
  onFileSelected: (file: File) => void;
  onValidationError: (message: string) => void;
  disabled?: boolean;
}

export function FileUploadButton({
  onFileSelected,
  onValidationError,
  disabled,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateFileClientSide(file);
    if (validationError) {
      onValidationError(validationError);
      return;
    }

    onFileSelected(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Attach a document"
        title="Attach a PDF, TXT, or Markdown document"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.19 5.19l-9.2 9.19a1.83 1.83 0 0 1-2.59-2.59l8.49-8.48" />
        </svg>
      </button>
    </>
  );
}
