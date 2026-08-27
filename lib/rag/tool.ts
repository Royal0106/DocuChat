import { tool } from "ai";
import { z } from "zod";
import { searchDocument } from "./search";

/**
 * Builds a `searchDocument` tool bound to a single document ID via closure.
 * The model can never search a different document — `documentId` is fixed
 * server-side to the document attached to the current chat.
 */
export function createSearchDocumentTool(documentId: string) {
  return tool({
    description:
      "Search the user's uploaded document for passages relevant to a query. " +
      "Always call this before answering questions about the document's contents. " +
      "Returns evidence excerpts labeled E1, E2, etc. with their source location.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe("A focused natural-language query describing the information needed."),
    }),
    execute: async ({ query }) => {
      const evidence = await searchDocument(documentId, query, 5);
      return { evidence };
    },
  });
}
