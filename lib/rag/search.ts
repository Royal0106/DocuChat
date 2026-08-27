import { cosineDistance, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentChunks, documents } from "@/db/schema";
import { embedQuery } from "@/lib/ai/embeddings";
import type { EvidenceItem } from "./types";

export type { EvidenceItem } from "./types";

/**
 * Searches only the chunks belonging to `documentId`. The caller must
 * resolve `documentId` server-side from the active chat — never accept it
 * from client or model input — so retrieval can't cross into another
 * conversation's document.
 */
export async function searchDocument(
  documentId: string,
  query: string,
  limit = 5,
): Promise<EvidenceItem[]> {
  const queryEmbedding = await embedQuery(query);
  const distance = cosineDistance(documentChunks.embedding, queryEmbedding);

  const rows = await db
    .select({
      id: documentChunks.id,
      content: documentChunks.content,
      pageNumber: documentChunks.pageNumber,
      sectionTitle: documentChunks.sectionTitle,
      filename: documents.filename,
      distance,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(distance)
    .limit(limit);

  return rows.map((row, index) => ({
    evidenceId: `E${index + 1}`,
    chunkId: row.id,
    filename: row.filename,
    pageNumber: row.pageNumber,
    sectionTitle: row.sectionTitle,
    excerpt: row.content,
    score: 1 - Number(row.distance),
  }));
}
