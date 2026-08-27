import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set");
}

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/**
 * Centralized model configuration. Change model IDs here only.
 */
export const AI_CONFIG = {
  // gemini-3.7-flash was requested, but is currently returning 503 "high
  // demand" errors from Google's API. gemini-3.6-flash is the reliable
  // fallback for now — see README "Known limitations". Change this one
  // line to switch back once capacity recovers.
  generationModelId: "gemini-3.6-flash",
  embeddingModelId: "gemini-embedding-2",
  embeddingDimensions: EMBEDDING_DIMENSIONS,
} as const;

export const generationModel = google(AI_CONFIG.generationModelId);
export const embeddingModel = google.textEmbeddingModel(AI_CONFIG.embeddingModelId);
