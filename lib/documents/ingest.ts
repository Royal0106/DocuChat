import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentChunks, documents } from "@/db/schema";
import { embedDocumentChunks } from "@/lib/ai/embeddings";
import { chunkExtraction } from "./chunk";
import { extractDocument } from "./extract";
import { DocumentExtractionError, type SupportedMimeType } from "./types";

/**
 * Extracts, chunks and embeds a document, then persists the results.
 * On any failure the document is marked `failed` with a useful message —
 * it can never be left in a state that looks `ready` without valid chunks.
 */
export async function ingestDocument(
  documentId: string,
  buffer: Buffer,
  mimeType: SupportedMimeType,
): Promise<void> {
  try {
    await db.update(documents).set({ status: "extracting" }).where(eq(documents.id, documentId));

    const extraction = await extractDocument(buffer, mimeType);

    await db.update(documents).set({ status: "indexing" }).where(eq(documents.id, documentId));

    const chunks = chunkExtraction(extraction);
    if (chunks.length === 0) {
      throw new DocumentExtractionError(
        "EMPTY_DOCUMENT",
        "No usable text could be extracted from this document.",
      );
    }

    const embeddings = await embedDocumentChunks(chunks.map((chunk) => chunk.content));

    await db.transaction(async (tx) => {
      await tx.insert(documentChunks).values(
        chunks.map((chunk, index) => ({
          documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          sectionTitle: chunk.sectionTitle,
          location: chunk.location,
          embedding: embeddings[index],
        })),
      );

      await tx
        .update(documents)
        .set({
          status: "ready",
          pageCount: extraction.pageCount,
          metadata: extraction.metadata,
        })
        .where(eq(documents.id, documentId));
    });
  } catch (error) {
    const message =
      error instanceof DocumentExtractionError
        ? error.message
        : "Failed to process the document. Please try again.";

    console.error(`Document ingestion failed for ${documentId}:`, error);

    await db
      .update(documents)
      .set({ status: "failed", errorMessage: message })
      .where(eq(documents.id, documentId));
  }
}
