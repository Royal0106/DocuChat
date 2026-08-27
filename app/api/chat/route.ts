import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { chats, documents, messages as messagesTable } from "@/db/schema";
import { generationModel } from "@/lib/ai/models";
import { buildSystemPrompt } from "@/lib/rag/prompt";
import { createSearchDocumentTool } from "@/lib/rag/tool";

export const maxDuration = 60;

const requestSchema = z.object({
  id: z.string().uuid(),
  messages: z.array(z.record(z.string(), z.unknown())),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return new Response("Invalid request body", { status: 400 });
  }

  const chatId = parsed.data.id;
  const uiMessages = parsed.data.messages as unknown as UIMessage[];

  const chat = await db.query.chats.findFirst({ where: eq(chats.id, chatId) });
  if (!chat) {
    return new Response("Chat not found", { status: 404 });
  }

  const document = await db.query.documents.findFirst({
    where: eq(documents.chatId, chatId),
    orderBy: desc(documents.createdAt),
  });

  if (!document || document.status !== "ready") {
    return new Response("This chat does not have a ready document to search yet.", {
      status: 400,
    });
  }

  const lastMessage = uiMessages[uiMessages.length - 1];
  if (lastMessage?.role === "user") {
    await db.insert(messagesTable).values({
      chatId,
      aiMessageId: lastMessage.id,
      role: "user",
      parts: lastMessage.parts,
    });
  }

  const tools = { searchDocument: createSearchDocumentTool(document.id) };

  const result = streamText({
    model: generationModel,
    system: buildSystemPrompt(document.filename),
    messages: await convertToModelMessages(uiMessages, { tools }),
    tools,
    stopWhen: stepCountIs(5),
    onError: ({ error }) => {
      console.error("streamText error:", error);
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: uiMessages,
    onFinish: async ({ responseMessage }) => {
      if (responseMessage.role !== "assistant") return;
      // A failed/aborted generation still produces a responseMessage shell
      // with no parts — skip persisting it so errors don't leave empty
      // assistant bubbles in the chat history.
      if (responseMessage.parts.length === 0) return;
      await db.insert(messagesTable).values({
        chatId,
        aiMessageId: responseMessage.id,
        role: "assistant",
        parts: responseMessage.parts,
      });
      await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
    },
  });
}
