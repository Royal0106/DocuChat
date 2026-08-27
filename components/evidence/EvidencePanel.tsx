"use client";

import { useState } from "react";
import type { EvidenceItem } from "@/lib/rag/types";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SourceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}

export function evidenceElementId(toolCallId: string, evidenceId: string): string {
  return `evidence-${toolCallId}-${evidenceId}`;
}

interface EvidencePanelProps {
  toolCallId: string;
  evidence: EvidenceItem[];
  defaultOpen?: boolean;
}

export function EvidencePanel({ toolCallId, evidence, defaultOpen = false }: EvidencePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (evidence.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <SourceIcon />
        No matching passages were found in the document.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-500 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
      >
        <span className="flex items-center gap-1.5">
          <SourceIcon />
          {evidence.length} source{evidence.length === 1 ? "" : "s"} used
        </span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <ul className="space-y-2 border-t border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
          {evidence.map((item) => (
            <li
              key={item.evidenceId}
              id={evidenceElementId(toolCallId, item.evidenceId)}
              className="scroll-mt-24 rounded-md border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {item.evidenceId}
                </span>
                <span className="font-medium text-neutral-700 dark:text-neutral-200">
                  {item.filename}
                </span>
                {item.pageNumber !== null ? (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    · page {item.pageNumber}
                  </span>
                ) : null}
                {item.sectionTitle ? (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    · {item.sectionTitle}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                {item.excerpt}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
