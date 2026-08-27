import { extractText, getDocumentProxy } from "unpdf";
import { DocumentExtractionError, type ExtractedSection, type ExtractionResult } from "./types";

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/[ \t]+/g, " ").trim())
    .filter((block) => block.length > 0);
}

export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  let pdf;
  let totalPages: number;
  let pages: string[];

  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: false });
    totalPages = result.totalPages;
    pages = result.text;
  } catch (error) {
    throw new DocumentExtractionError(
      "EXTRACTION_FAILED",
      `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const sections: ExtractedSection[] = pages.map((pageText, index) => ({
    pageNumber: index + 1,
    sectionTitle: null,
    headingLevel: null,
    paragraphs: splitIntoParagraphs(pageText),
  }));

  const hasText = sections.some((section) => section.paragraphs.length > 0);
  if (!hasText) {
    throw new DocumentExtractionError(
      "NO_EXTRACTABLE_TEXT",
      "This PDF has no extractable text. Scanned or image-only PDFs are not supported in this version — OCR is out of scope.",
    );
  }

  return {
    sections,
    pageCount: totalPages,
    metadata: { totalPages },
  };
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*$/;

export function extractMarkdown(text: string): ExtractionResult {
  const lines = text.split(/\r\n|\r|\n/);

  const sections: ExtractedSection[] = [];
  let currentTitle: string | null = null;
  let currentLevel: number | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const paragraphs = splitIntoParagraphs(buffer.join("\n"));
    if (paragraphs.length > 0) {
      sections.push({
        pageNumber: null,
        sectionTitle: currentTitle,
        headingLevel: currentLevel,
        paragraphs,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const match = HEADING_PATTERN.exec(line.trim());
    if (match) {
      flush();
      currentLevel = match[1].length;
      currentTitle = match[2].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  const hasText = sections.some((section) => section.paragraphs.length > 0);
  if (!hasText) {
    throw new DocumentExtractionError("EMPTY_DOCUMENT", "This Markdown document is empty.");
  }

  return {
    sections,
    pageCount: null,
    metadata: { headingCount: sections.filter((s) => s.sectionTitle).length },
  };
}

export function extractTxt(text: string): ExtractionResult {
  const paragraphs = splitIntoParagraphs(text);

  if (paragraphs.length === 0) {
    throw new DocumentExtractionError("EMPTY_DOCUMENT", "This text document is empty.");
  }

  return {
    sections: [
      {
        pageNumber: null,
        sectionTitle: null,
        headingLevel: null,
        paragraphs,
      },
    ],
    pageCount: null,
    metadata: {},
  };
}

export async function extractDocument(
  buffer: Buffer,
  mimeType: "application/pdf" | "text/plain" | "text/markdown",
): Promise<ExtractionResult> {
  switch (mimeType) {
    case "application/pdf":
      return extractPdf(buffer);
    case "text/markdown":
      return extractMarkdown(buffer.toString("utf-8"));
    case "text/plain":
      return extractTxt(buffer.toString("utf-8"));
    default:
      throw new DocumentExtractionError("UNSUPPORTED_TYPE", `Unsupported MIME type: ${mimeType}`);
  }
}
