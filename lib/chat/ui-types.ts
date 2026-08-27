import type { UIMessage } from "ai";
import type { SearchDocumentToolOutput } from "@/lib/rag/types";

export type AppUITools = {
  searchDocument: {
    input: { query: string };
    output: SearchDocumentToolOutput;
  };
};

export type AppUIMessage = UIMessage<never, never, AppUITools>;
