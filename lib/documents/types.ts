export type SupportedMimeType = "application/pdf" | "text/plain" | "text/markdown";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB, conservative for a Vercel Function

export const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown"] as const;

export const ACCEPTED_MIME_TYPES: Record<string, SupportedMimeType> = {
  "application/pdf": "application/pdf",
  "text/plain": "text/plain",
  "text/markdown": "text/markdown",
  "text/x-markdown": "text/markdown",
};

/** One logically atomic unit of source text that chunking must not split across. */
export interface ExtractedSection {
  /** 1-based page number, for PDFs only. */
  pageNumber: number | null;
  /** Nearest heading title, for Markdown only. */
  sectionTitle: string | null;
  /** Optional heading depth (1-6), for Markdown only. */
  headingLevel: number | null;
  /** Logical paragraphs/blocks within this section, in reading order. */
  paragraphs: string[];
}

export interface ExtractionResult {
  sections: ExtractedSection[];
  pageCount: number | null;
  metadata: Record<string, unknown>;
}

export class DocumentExtractionError extends Error {
  code: "UNSUPPORTED_TYPE" | "EMPTY_DOCUMENT" | "NO_EXTRACTABLE_TEXT" | "EXTRACTION_FAILED";

  constructor(code: DocumentExtractionError["code"], message: string) {
    super(message);
    this.name = "DocumentExtractionError";
    this.code = code;
  }
}
