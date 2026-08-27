import { embed, embedMany } from "ai";
import { AI_CONFIG, embeddingModel } from "./models";

/**
 * Embeds document chunks for storage. Uses RETRIEVAL_DOCUMENT task type so
 * Gemini optimizes the embedding for being searched against later.
 */
export async function embedDocumentChunks(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
    providerOptions: {
      google: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: AI_CONFIG.embeddingDimensions,
      },
    },
  });

  return embeddings;
}

/**
 * Embeds a user search query. Uses RETRIEVAL_QUERY task type so Gemini
 * optimizes the embedding for retrieving relevant documents.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: query,
    providerOptions: {
      google: {
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: AI_CONFIG.embeddingDimensions,
      },
    },
  });

  return embedding;
}
