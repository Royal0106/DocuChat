import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMENSIONS = 768;

export const documentStatusValues = [
  "uploading",
  "extracting",
  "indexing",
  "ready",
  "failed",
] as const;
export type DocumentStatus = (typeof documentStatusValues)[number];

export const messageRoleValues = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof messageRoleValues)[number];

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("uploading").$type<DocumentStatus>(),
  errorMessage: text("error_message"),
  pageCount: integer("page_count"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    sectionTitle: text("section_title"),
    location: jsonb("location").$type<Record<string, unknown>>(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("document_chunks_document_id_idx").on(table.documentId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    aiMessageId: text("ai_message_id"),
    role: varchar("role", { length: 20 }).notNull().$type<MessageRole>(),
    parts: jsonb("parts").notNull().$type<unknown[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_chat_id_idx").on(table.chatId)],
);

export const chatsRelations = relations(chats, ({ many }) => ({
  documents: many(documents),
  messages: many(messages),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  chat: one(chats, { fields: [documents.chatId], references: [chats.id] }),
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, { fields: [documentChunks.documentId], references: [documents.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, { fields: [messages.chatId], references: [chats.id] }),
}));

export type ChatRow = typeof chats.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
