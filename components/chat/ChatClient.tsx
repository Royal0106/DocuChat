"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { DocumentRow } from "@/db/schema";
import type { AppUIMessage } from "@/lib/chat/ui-types";
import { uploadDocument } from "@/lib/chat/upload-client";
import { DocumentStatusCard } from "./DocumentStatusCard";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

interface ChatClientProps {
  chatId: string;
  initialMessages: AppUIMessage[];
  initialDocument: DocumentRow | null;
}

export function ChatClient({ chatId, initialMessages, initialDocument }: ChatClientProps) {
  const [document, setDocument] = useState<DocumentRow | null>(initialDocument);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const transport = useMemo(() => new DefaultChatTransport<AppUIMessage>({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, error } = useChat<AppUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
  });

  const documentReady = document?.status === "ready";
  const isBusy = status === "submitted" || status === "streaming";

  async function handleFile(file: File) {
    setUploadError(null);
    setIsUploading(true);
    try {
      const result = await uploadDocument(file, chatId);
      setDocument(result.document);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload the document.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleSend(text: string) {
    sendMessage({ text });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
      <div className="flex-1 overflow-y-auto">
        {document ? (
          <div className="sticky top-0 z-10 -mx-4 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/90">
            <DocumentStatusCard document={document} />
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {documentReady
                ? "Ask a question about your document to get started."
                : document?.status === "failed"
                  ? "This document couldn't be processed. Attach a different file to try again."
                  : "Once your document finishes indexing, you can start asking questions about it."}
            </p>
          </div>
        ) : (
          <MessageList messages={messages} status={status} />
        )}

        {error ? (
          <div className="my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            Something went wrong generating a response. Please try again.
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 bg-white pb-4 pt-2 dark:bg-neutral-950">
        {uploadError ? (
          <p className="mb-2 text-xs text-red-600 dark:text-red-400" role="alert">
            {uploadError}
          </p>
        ) : null}
        <Composer
          chatId={chatId}
          documentReady={documentReady}
          isUploading={isUploading}
          isBusy={isBusy}
          onFile={handleFile}
          onUploadError={setUploadError}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
