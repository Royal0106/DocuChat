import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chats, documents, messages, type ChatRow, type DocumentRow, type MessageRow } from "@/db/schema";

export interface ChatContext {
  chat: ChatRow;
  document: DocumentRow | null;
  messages: MessageRow[];
}

export async function getChatContext(chatId: string): Promise<ChatContext | null> {
  const chat = await db.query.chats.findFirst({ where: eq(chats.id, chatId) });
  if (!chat) return null;

  const [document, chatMessages] = await Promise.all([
    db.query.documents.findFirst({
      where: eq(documents.chatId, chatId),
      orderBy: desc(documents.createdAt),
    }),
    db.query.messages.findMany({
      where: eq(messages.chatId, chatId),
      orderBy: asc(messages.createdAt),
    }),
  ]);

  return { chat, document: document ?? null, messages: chatMessages };
}
