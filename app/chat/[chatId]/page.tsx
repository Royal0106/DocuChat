import { notFound } from "next/navigation";
import { z } from "zod";
import { ChatClient } from "@/components/chat/ChatClient";
import { getChatContext } from "@/lib/chat/queries";
import type { AppUIMessage } from "@/lib/chat/ui-types";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  if (!z.string().uuid().safeParse(chatId).success) {
    notFound();
  }

  const context = await getChatContext(chatId);
  if (!context) {
    notFound();
  }

  const initialMessages: AppUIMessage[] = context.messages.map((message) => ({
    id: message.aiMessageId ?? message.id,
    role: message.role as AppUIMessage["role"],
    parts: message.parts as AppUIMessage["parts"],
  }));

  return (
    <ChatClient chatId={chatId} initialMessages={initialMessages} initialDocument={context.document} />
  );
}
