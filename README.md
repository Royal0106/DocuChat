# Document Chat

A single-document RAG chat application. Upload one PDF, TXT, or Markdown file from the
chat composer and ask questions about it — answers are streamed, grounded in retrieved
passages, and cited back to the exact page or section they came from.

Built as a scoped, five-hour take-home: one document per conversation, no auth, no
document management UI. The goal was a small system that is *correct* end to end —
persistence, retrieval, and citations all survive a reload — rather than a feature-rich
demo with soft edges.

## Live application

`<!-- TODO: add Vercel deployment URL here -->`

## Architecture

```
┌─────────────┐
│    Browser    │
│               │
│   useChat()   │
│  file upload  │
└─────────────┘
       |
 HTTP request
       v
┌───────────────────────────────────────────┐
│          Next.js (App Router)             │
│                                           │
│ app/chat/[chatId]     server component    │
│ app/api/documents     upload + ingest     │
│ app/api/chat          streamText + tool   │
│                                           │
│ lib/documents/  extract -> chunk -> embed │
│ lib/rag/        searchDocument, prompt    │
│ lib/ai/         centralized model config  │
└───────────────────────────────────────────┘
               |              |
             SQL            HTTPS
               v              v
      ┌─────────────────┐ ┌────────────────────┐
      │   Neon Postgres   │ │  Google Gemini API   │
      │    + pgvector     │ │                      │
      │                   │ │   gemini-3.6-flash   │
      │       chats       │ │  gemini-embedding-2  │
      │     documents     │ └────────────────────┘
      │  document_chunks  │
      │     messages      │
      └─────────────────┘
```

- **`app/chat/[chatId]/page.tsx`** — server component. Verifies the chat exists (404
  otherwise), loads the document and full message history from Postgres, and hands it to
  the client as `initialMessages` for `useChat`.
- **`app/api/documents/route.ts`** — receives the uploaded file, validates it, creates
  the chat (if new) and a `documents` row, then runs ingestion synchronously and returns
  the final status.
- **`app/api/chat/route.ts`** — resolves the active document for the chat, persists the
  user message, streams a grounded answer via `streamText` with a `searchDocument` tool
  bound to that document, and persists the final assistant message (including tool parts)
  on finish.

## Technology choices

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Server components for data loading, route handlers for streaming/upload, one deployable unit on Vercel. |
| LLM SDK | Vercel AI SDK `ai@7`, `@ai-sdk/google@4`, `@ai-sdk/react@4` | Current stable `useChat`/`streamText`/`tool()` APIs — verified directly against the installed package's type definitions rather than assumed from memory. |
| Database | Neon Postgres (free tier) | Serverless Postgres with a real `pgvector` extension; no separate vector DB to run. |
| ORM | Drizzle ORM (`drizzle-orm`, `drizzle-kit`) | Typed schema, native `vector()` column type, and a native `cosineDistance()` SQL helper — no raw pgvector syntax needed. |
| DB driver | `pg` (node-postgres) over `drizzle-orm/node-postgres` | Full transaction support (needed for atomic ingestion), runs in the Node.js runtime the upload/ingest routes require. |
| PDF extraction | `unpdf` | A pdf.js build made for serverless/edge runtimes; extracts text **per page** without native bindings. |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` | No component framework; typography plugin only for Markdown rendering. |
| Markdown rendering | `react-markdown` + `remark-gfm` | Assistant responses can include lists/tables/emphasis safely (no `dangerouslySetInnerHTML`). |

## Database schema

```
chats                       documents                     document_chunks
─────                       ─────────                     ───────────────
id (uuid, pk)                id (uuid, pk)                 id (uuid, pk)
title                        chat_id  (fk → chats.id)      document_id (fk → documents.id)
created_at                   filename                      chunk_index
updated_at                   mime_type                     content
                              file_size                     page_number
                              status                        section_title
                              error_message                 location (jsonb)
                              page_count                    embedding (vector(768))
                              metadata (jsonb)               created_at
                              created_at

messages
────────
id (uuid, pk)
chat_id (fk → chats.id)
ai_message_id
role
parts (jsonb)   -- full UI message parts: text, tool calls, tool results
created_at
```

- `documents.chat_id → chats.id` and `document_chunks.document_id → documents.id` are
  both `ON DELETE CASCADE` — deleting a chat cleans up its document and chunks.
- The "active document" for a chat is simply the most recent `documents` row for that
  `chat_id` (`ORDER BY created_at DESC LIMIT 1`). A failed upload can be immediately
  retried by uploading again; the newest row wins without needing a separate
  replace/delete flow.
- `messages.parts` stores the full Vercel AI SDK UI message parts array (text parts,
  `tool-searchDocument` parts with their `input`/`output`), not a flattened string — this
  is what lets a reload reconstruct Evidence Cards and citations exactly as they streamed.

## Document ingestion flow

1. Client validates file type/size, `POST`s `multipart/form-data` to `/api/documents`.
2. Server re-validates type/size (never trusts the client), creates the `chats` row (if
   this is a new conversation) and a `documents` row with `status: "uploading"`.
3. `lib/documents/ingest.ts` runs, moving status through `extracting` → `indexing`:
   - **Extract** (`lib/documents/extract.ts`): PDF → per-page text via `unpdf`; Markdown →
     sections split on ATX headings (`#`…`######`); TXT → paragraph blocks. Each extracted
     **section** (a page, or a heading block) carries its own page number / section title.
   - **Chunk** (`lib/documents/chunk.ts`): a deterministic, dependency-free chunker packs
     paragraphs into ~1,300-character chunks (max 1,500) with ~200-character overlap. It
     never merges paragraphs across a section boundary, so a chunk is never split across a
     PDF page or a Markdown heading — citation precision is preserved.
   - **Embed** (`lib/ai/embeddings.ts`): all chunks for a document are embedded in one
     `embedMany` batch call with `taskType: "RETRIEVAL_DOCUMENT"`.
4. Chunk rows + the `status: "ready"` update are written in a **single database
   transaction** — a failed or interrupted ingestion can never leave a document that looks
   `ready` without valid, embedded chunks. Any thrown error is caught and the document is
   marked `failed` with a user-readable message instead.

## RAG / retrieval flow

`lib/rag/search.ts` exports `searchDocument(documentId, query, limit)`:

1. Embeds the query with `taskType: "RETRIEVAL_QUERY"` (same model/dimensionality as
   stored chunks).
2. Runs `SELECT ... ORDER BY cosineDistance(embedding, queryEmbedding) LIMIT 5`, scoped
   with `WHERE document_chunks.document_id = $documentId`.
3. Maps the top rows to evidence items labeled `E1`, `E2`, … in rank order.

**`documentId` is never accepted from the client or the model.** `app/api/chat/route.ts`
resolves it server-side from the chat, then closes over it when building the
`searchDocument` tool (`lib/rag/tool.ts`) — the model can only ever search the one
document attached to the active conversation, regardless of what it passes as input.

## Citation strategy

The system prompt (`lib/rag/prompt.ts`) instructs the model to call `searchDocument`
before answering any factual question, treat retrieved passages as ground truth, cite
claims inline as `[E1]`, `[E2]`, … using only identifiers the tool actually returned, and
say plainly when the evidence doesn't answer the question.

On the client, `[E1]`-style markers are rewritten into clickable buttons
(`components/chat/Markdown.tsx`) that scroll to the matching Evidence Card. Because the
full tool call/result is persisted as part of the assistant message's `parts`, citations
and their source excerpts are exact after a reload — nothing is re-derived or
re-summarized.

## Structured UI: Evidence Cards

`searchDocument` is a typed Vercel AI SDK tool (`lib/rag/tool.ts`) whose result is
rendered by `components/evidence/EvidencePanel.tsx` wherever a `tool-searchDocument` part
appears in a message. It shows a collapsed summary ("N sources used") and expands to each
evidence item's id, filename, page/section, and excerpt — sourced directly from the
persisted tool output, not re-fetched.

## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and GOOGLE_GENERATIVE_AI_API_KEY
npm run db:migrate     # enables pgvector + creates tables on your Neon database
npm run dev
```

### Neon setup

1. Create a free Neon project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string into `DATABASE_URL` in `.env`.
3. `pgvector` does **not** need to be enabled manually — `npm run db:migrate` runs
   `CREATE EXTENSION IF NOT EXISTS vector;` before applying the schema.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Neon Postgres connection string (`sslmode=require` recommended). Server-side only. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Server-side only — never exposed as `NEXT_PUBLIC_*`. |

### Migration commands

```bash
npm run db:generate   # regenerate SQL migrations from db/schema.ts after a schema change
npm run db:migrate     # enable pgvector + apply migrations to DATABASE_URL
npm run db:studio      # open Drizzle Studio against the configured database
```

### Model configuration

Model IDs live in one place, `lib/ai/models.ts` (`AI_CONFIG.generationModelId` /
`AI_CONFIG.embeddingModelId`) — change either there.

## Vercel deployment

1. Push this repo to GitHub and import it in Vercel.
2. Add `DATABASE_URL` and `GOOGLE_GENERATIVE_AI_API_KEY` as Vercel project environment
   variables (Production + Preview).
3. Run `npm run db:migrate` once against the production `DATABASE_URL` (locally, or as a
   one-off `vercel env pull && npm run db:migrate`) before the first deploy — Vercel does
   not run migrations automatically.
4. Deploy. `app/api/documents/route.ts` and `app/api/chat/route.ts` both declare
   `export const maxDuration = 60;` for the ingestion/generation work; confirm your Vercel
   plan allows a Node.js function duration of at least 60s (Hobby allows up to 60s; if
   you're on a plan with a lower cap, lower this to match).

## Key architectural trade-offs

- **Synchronous ingestion, not a background job.** Extraction, chunking, and embedding all
  happen inside the `POST /api/documents` request instead of a queue/worker. This keeps
  the system simple (no job infra, no polling endpoint) at the cost of the client waiting
  out the full ingestion time on one request, bounded by the 4 MB upload cap and a 60s
  function timeout. The UI's `uploading` → `extracting` → `indexing` states are therefore
  shown as a single coarse "processing" spinner client-side rather than granular
  server-pushed sub-states — the state machine exists in the schema, but a synchronous
  request can only report its final outcome, not live intermediate progress.
- **One document per chat, resolved by recency, not a `chats.document_id` column.** The
  active document is "the newest `documents` row for this `chat_id`". This makes replacing
  a failed upload trivial (just upload again) without a separate delete/replace API, at
  the cost of `documents` accumulating superseded rows for a chat instead of being
  strictly 1:1.
- **`pg`/node-postgres over Neon's HTTP/serverless driver.** Ingestion needs a real
  transaction (chunk insert + `status: "ready"` must commit atomically), which Neon's
  HTTP driver doesn't support. This means routes touching the database run in the Node.js
  runtime, not the Edge runtime — an acceptable trade for correctness.
- **Exact pgvector cosine search, not an HNSW/IVFFlat index.** A single document produces
  on the order of tens of chunks, not millions. An approximate index adds build cost,
  tuning parameters (`lists`/`m`/`ef_construction`), and recall trade-offs for zero
  measurable latency benefit at this scale — `ORDER BY cosineDistance(...) LIMIT 5` over a
  few dozen rows is effectively instant and always exact.

## Known limitations / unfinished work

- **One document per chat** is a deliberate scope boundary from the assignment, not a
  missing feature — no multi-document workspaces, no document management UI, no auth.
- **4 MB upload limit** exists because ingestion runs inside a single Vercel Function
  invocation (request body size + execution time budget), not because of any inherent
  content limit — a background-job architecture could relax this.
- **No OCR.** Scanned/image-only PDFs are detected (`extractText` returns no content) and
  fail cleanly with an explanatory message rather than silently ingesting nothing.
- **`gemini-3.7-flash` vs `gemini-3.6-flash`.** The assignment's preferred generation
  model, `gemini-3.7-flash`, is a valid model ID but returned persistent `503 "high
  demand"` errors from Google's API throughout development and live testing (confirmed
  with a standalone repro script hitting the model directly, independent of this app's
  code). `AI_CONFIG.generationModelId` in `lib/ai/models.ts` is currently set to the
  reliable `gemini-3.6-flash`; switching back is a one-line change once capacity recovers.
- **Coarse ingestion progress**, as noted above under trade-offs.
- **No automated test suite.** Verification for this submission was a live, end-to-end
  manual pass (Playwright-driven browser session + direct API calls) against the real Neon
  database and Gemini API, documented in the testing notes below — not unit/integration
  tests committed to the repo.

## AI-generated output I corrected or rejected

Two real bugs surfaced during live end-to-end testing (not hypothetical):

1. **Silent empty-answer gap after a tool call.** My initial implementation trusted the AI
   SDK's automatic multi-step tool loop (`stopWhen: stepCountIs(5)`) to always follow a
   `searchDocument` call with a text answer in the next step. Live testing (a real browser
   session, not a mocked one) surfaced a case where Gemini's follow-up step returned no
   visible text at all — the Evidence Card rendered, but the assistant bubble was just
   empty, with no error and no explanation. I traced it by inspecting the persisted
   `messages.parts` row directly in Postgres and confirming the assistant message had only
   a `tool-searchDocument` part and no `text` part. Rather than assume this couldn't
   happen, I added an explicit UI fallback in `MessageList.tsx`
   (`showNoAnswerNotice`) that detects "tool ran, generation finished, but no text part
   exists" and surfaces a clear "please try again" notice instead of a silent gap.
2. **Failed generations were persisting an empty assistant message.** My first version of
   `onFinish` in `app/api/chat/route.ts` persisted `responseMessage` unconditionally. When
   a request hit a transient Gemini `503`, the stream's `onFinish` callback still fired
   with a `responseMessage` shell that had `parts: []`, and my code inserted it anyway —
   which would have littered chat history with empty assistant bubbles after every
   transient provider error. I caught this by reading the raw database rows after a live
   503 during testing, not by inspection alone, and added a `responseMessage.parts.length
   === 0` guard to skip persisting those shells.

## AI tools used during development

Built with Claude Code (Sonnet 5), which wrote the implementation, ran the Neon
migrations, and drove a live Playwright browser session against the real database and
Gemini API to verify the happy path, PDF page citations, and the unsupported-file/
no-extractable-text error paths described above.

## Approximate time spent

`<!-- TODO: enter actual time spent — this session's work was continuous, not timed against a clock -->`
