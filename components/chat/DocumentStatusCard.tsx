import type { DocumentRow } from "@/db/schema";
import { formatBytes, formatFileKind } from "@/lib/utils/format";

const STATUS_LABEL: Record<DocumentRow["status"], string> = {
  uploading: "Uploading…",
  extracting: "Extracting text…",
  indexing: "Indexing…",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_STYLE: Record<DocumentRow["status"], string> = {
  uploading: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  extracting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  indexing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function FileIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

interface DocumentStatusCardProps {
  document: Pick<
    DocumentRow,
    "filename" | "mimeType" | "fileSize" | "status" | "errorMessage" | "pageCount"
  >;
}

export function DocumentStatusCard({ document }: DocumentStatusCardProps) {
  const isProcessing = ["uploading", "extracting", "indexing"].includes(document.status);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        <FileIcon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {document.filename}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{formatFileKind(document.mimeType)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatBytes(document.fileSize)}</span>
          {document.pageCount ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {document.pageCount} page{document.pageCount === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
        </div>
        {document.status === "failed" && document.errorMessage ? (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{document.errorMessage}</p>
        ) : null}
      </div>
      <span
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[document.status]}`}
        role="status"
      >
        {isProcessing ? <Spinner /> : null}
        {STATUS_LABEL[document.status]}
      </span>
    </div>
  );
}
