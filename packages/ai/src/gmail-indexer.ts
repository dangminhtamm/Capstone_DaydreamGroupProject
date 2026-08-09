import { insertMemoryChunks } from "@second-brain/db";
import {
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import {
  normalizeWhitespace,
  splitTextByBoundary,
  withEmbeddings,
} from "./indexing-utils.ts";
import type { PersistedMemoryChunkPayload } from "./memory-indexer.ts";
import { withMemoryDate, type MemoryChunkMetadata } from "./types.ts";

export interface GmailMessageInput {
  messageId: string;
  externalId: string;
  threadId?: string | null;
  sender: string;
  subject: string;
  snippet?: string | null;
  body: string;
  receivedAt?: Date | null;
}

export interface IndexMemoryFromGmailInput {
  userId: string;
  message: GmailMessageInput;
  embeddingProvider?: Pick<AdvancedEmbeddingProvider, "embedDocument">;
  insertChunks?: (chunks: PersistedMemoryChunkPayload[]) => Promise<unknown>;
}

export interface IndexMemoryFromGmailResult {
  sourceType: "gmail";
  messageId: string;
  chunkCount: number;
}

export async function indexMemoryFromGmail(
  input: IndexMemoryFromGmailInput,
): Promise<IndexMemoryFromGmailResult> {
  const occurredAt = input.message.receivedAt ?? new Date();
  const cleanBody = normalizeWhitespace(input.message.body);
  const cleanSnippet = normalizeWhitespace(input.message.snippet ?? "");
  const header = [
    `Gmail email from ${input.message.sender}.`,
    `Subject: ${input.message.subject || "(no subject)"}.`,
    cleanSnippet ? `Snippet: ${cleanSnippet}.` : "",
  ].filter(Boolean).join(" ");
  const textForChunking = normalizeWhitespace([header, cleanBody].filter(Boolean).join("\n\n"));

  if (!textForChunking) {
    return {
      sourceType: "gmail",
      messageId: input.message.messageId,
      chunkCount: 0,
    };
  }

  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();
  const doInsert = input.insertChunks ?? insertMemoryChunks;
  const parts = splitTextByBoundary(textForChunking, 1200);

  const chunks = parts.map((text, index) => {
    const metadata: MemoryChunkMetadata = withMemoryDate({
      date: occurredAt.toISOString(),
      sourceType: "gmail",
      sourceId: input.message.messageId,
      sourceTitle: input.message.subject || "Gmail message",
      sourceUrl: `https://mail.google.com/mail/u/0/#all/${input.message.externalId}`,
      chunkIndex: index,
      chunkType: index === 0 ? "general_note" : "general",
      people: [input.message.sender],
      tags: ["google", "gmail", "email"],
      importance: 3,
    });

    return {
      userId: input.userId,
      sourceType: "gmail",
      sourceId: input.message.messageId,
      chunkIndex: index,
      chunkType: metadata.chunkType,
      text,
      evidence: text.slice(0, 500),
      metadata,
      occurredAt,
    } satisfies Omit<PersistedMemoryChunkPayload, "embedding">;
  });

  const persistedChunks = await withEmbeddings(chunks, embeddingProvider);
  await doInsert(persistedChunks);

  return {
    sourceType: "gmail",
    messageId: input.message.messageId,
    chunkCount: persistedChunks.length,
  };
}
