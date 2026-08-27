"use client";

import { Fragment } from "react";
import { Markdown } from "./Markdown";
import { EvidencePanel, evidenceElementId } from "@/components/evidence/EvidencePanel";
import type { AppUIMessage } from "@/lib/chat/ui-types";

function SearchingIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Searching the document…
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="Assistant is responding">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 dark:bg-neutral-500"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}

function buildCitationTargets(message: AppUIMessage): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of message.parts) {
    if (part.type === "tool-searchDocument" && part.state === "output-available") {
      for (const item of part.output.evidence) {
        map.set(item.evidenceId, evidenceElementId(part.toolCallId, item.evidenceId));
      }
    }
  }
  return map;
}

interface MessageBubbleProps {
  message: AppUIMessage;
  isLastAssistantMessage: boolean;
  isStreaming: boolean;
}

function MessageBubble({ message, isLastAssistantMessage, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const citationTargets = buildCitationTargets(message);
  const hasVisibleContent = message.parts.some(
    (part) => (part.type === "text" && part.text.length > 0) || part.type === "tool-searchDocument",
  );
  const hasFinalText = message.parts.some((part) => part.type === "text" && part.text.trim().length > 0);
  // Rarely, the model returns no visible text after a tool call resolves (a
  // provider-side quirk, not a bug in retrieval). Surface it instead of a
  // silent gap so the user knows to retry.
  const showNoAnswerNotice =
    !isUser && isLastAssistantMessage && !isStreaming && message.parts.length > 0 && !hasFinalText;

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
        {message.parts.map((part, index) => {
          const key = `${message.id}-${index}`;

          if (part.type === "text") {
            if (!part.text) return null;
            return (
              <div
                key={key}
                className={
                  isUser
                    ? "rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-2.5 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-2.5 dark:bg-neutral-800/70"
                }
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap text-sm">{part.text}</p>
                ) : (
                  <Markdown content={part.text} citationTargets={citationTargets} />
                )}
              </div>
            );
          }

          if (part.type === "tool-searchDocument") {
            if (part.state === "input-streaming" || part.state === "input-available") {
              return (
                <Fragment key={key}>
                  <SearchingIndicator />
                </Fragment>
              );
            }
            if (part.state === "output-available") {
              return (
                <EvidencePanel key={key} toolCallId={part.toolCallId} evidence={part.output.evidence} />
              );
            }
            if (part.state === "output-error") {
              return (
                <div
                  key={key}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                >
                  Document search failed: {part.errorText}
                </div>
              );
            }
          }

          return null;
        })}
        {!isUser && isLastAssistantMessage && isStreaming && !hasVisibleContent ? (
          <TypingIndicator />
        ) : null}
        {showNoAnswerNotice ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            The model didn&apos;t return a written answer for this question. Please try asking again.
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface MessageListProps {
  messages: AppUIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
}

export function MessageList({ messages, status }: MessageListProps) {
  const lastAssistantIndex = [...messages].map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="flex flex-1 flex-col gap-4 py-4">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLastAssistantMessage={index === lastAssistantIndex}
          isStreaming={status === "streaming" || status === "submitted"}
        />
      ))}
      {status === "submitted" && lastAssistantIndex !== messages.length - 1 ? (
        <div className="flex justify-start">
          <TypingIndicator />
        </div>
      ) : null}
    </div>
  );
}
