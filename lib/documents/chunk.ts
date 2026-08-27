import type { ExtractedSection, ExtractionResult } from "./types";

export const CHUNK_TARGET_SIZE = 1300;
export const CHUNK_MAX_SIZE = 1500;
export const CHUNK_OVERLAP = 200;
export const CHUNK_MIN_SIZE = 200;

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  location: Record<string, unknown> | null;
}

function takeOverlapTail(text: string, overlap: number): string {
  if (text.length <= overlap) return text;
  const tail = text.slice(text.length - overlap);
  const spaceIndex = tail.indexOf(" ");
  return spaceIndex === -1 ? tail : tail.slice(spaceIndex + 1);
}

/** Hard-splits a single paragraph that exceeds CHUNK_MAX_SIZE on its own. */
function splitOversizedParagraph(paragraph: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  while (start < paragraph.length) {
    let end = Math.min(start + CHUNK_TARGET_SIZE, paragraph.length);
    if (end < paragraph.length) {
      const lastSpace = paragraph.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    const piece = paragraph.slice(start, end).trim();
    if (piece.length > 0) pieces.push(piece);
    if (end >= paragraph.length) break;
    const nextStart = end - CHUNK_OVERLAP;
    start = nextStart > start ? nextStart : end;
  }
  return pieces;
}

/** Chunks the paragraphs of a single section (page or heading block). Never crosses section boundaries. */
function chunkSection(section: ExtractedSection): Array<{ content: string }> {
  const flatParagraphs: string[] = [];
  for (const paragraph of section.paragraphs) {
    if (paragraph.length > CHUNK_MAX_SIZE) {
      flatParagraphs.push(...splitOversizedParagraph(paragraph));
    } else {
      flatParagraphs.push(paragraph);
    }
  }

  const chunks: Array<{ content: string }> = [];
  let current = "";

  for (const paragraph of flatParagraphs) {
    if (current.length === 0) {
      current = paragraph;
      continue;
    }

    if (current.length + 2 + paragraph.length <= CHUNK_MAX_SIZE) {
      current += "\n\n" + paragraph;
      continue;
    }

    chunks.push({ content: current });
    const overlapTail = takeOverlapTail(current, CHUNK_OVERLAP);
    current = overlapTail ? `${overlapTail}\n\n${paragraph}` : paragraph;
  }

  if (current.length > 0) {
    if (chunks.length > 0 && current.length < CHUNK_MIN_SIZE) {
      chunks[chunks.length - 1].content += "\n\n" + current;
    } else {
      chunks.push({ content: current });
    }
  }

  return chunks;
}

export function chunkExtraction(extraction: ExtractionResult): DocumentChunk[] {
  const result: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const section of extraction.sections) {
    const sectionChunks = chunkSection(section);
    for (const chunk of sectionChunks) {
      result.push({
        chunkIndex: chunkIndex++,
        content: chunk.content,
        pageNumber: section.pageNumber,
        sectionTitle: section.sectionTitle,
        location: section.headingLevel !== null ? { headingLevel: section.headingLevel } : null,
      });
    }
  }

  return result;
}
