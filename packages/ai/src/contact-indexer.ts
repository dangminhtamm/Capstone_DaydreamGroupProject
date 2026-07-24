import { insertMemoryChunks } from "@second-brain/db";
import {
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import { withEmbeddings } from "./indexing-utils.ts";
import type { PersistedMemoryChunkPayload } from "./memory-indexer.ts";
import type { MemoryChunkMetadata } from "./types.ts";

export interface GoogleContactInput {
  contactId: string;
  externalId: string;
  displayName: string;
  emailAddresses?: string[];
  phoneNumbers?: string[];
  organizations?: string[];
  photoUrl?: string | null;
  updatedAt?: Date;
}

export interface IndexMemoryFromContactInput {
  userId: string;
  contacts: GoogleContactInput[];
  embeddingProvider?: Pick<AdvancedEmbeddingProvider, "embedDocument">;
  insertChunks?: (chunks: PersistedMemoryChunkPayload[]) => Promise<unknown>;
}

export interface IndexMemoryFromContactResult {
  sourceType: "contact";
  indexedContactCount: number;
  totalChunkCount: number;
  errors: Array<{ contactId: string; error: string }>;
}

export async function indexMemoryFromContact(
  input: IndexMemoryFromContactInput,
): Promise<IndexMemoryFromContactResult> {
  if (!input.contacts.length) {
    return {
      sourceType: "contact",
      indexedContactCount: 0,
      totalChunkCount: 0,
      errors: [],
    };
  }

  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();
  const doInsert = input.insertChunks ?? insertMemoryChunks;
  const errors: Array<{ contactId: string; error: string }> = [];
  let totalChunkCount = 0;

  for (const contact of input.contacts) {
    try {
      const chunks = buildContactChunks(input.userId, contact);
      if (!chunks.length) continue;

      const persistedChunks = await withEmbeddings(chunks, embeddingProvider);
      await doInsert(persistedChunks);
      totalChunkCount += persistedChunks.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ contactId: contact.contactId, error: message });
      console.error(
        `[ContactIndexer] Failed to index contact ${contact.contactId}: ${message}`,
      );
    }
  }

  return {
    sourceType: "contact",
    indexedContactCount: input.contacts.length - errors.length,
    totalChunkCount,
    errors,
  };
}

function buildContactChunks(
  userId: string,
  contact: GoogleContactInput,
): Omit<PersistedMemoryChunkPayload, "embedding">[] {
  const emails = unique(contact.emailAddresses ?? []);
  const phones = unique(contact.phoneNumbers ?? []);
  const organizations = unique(contact.organizations ?? []);
  const text = [
    `Google contact: ${contact.displayName}.`,
    emails.length ? `Emails: ${emails.join(", ")}.` : "",
    phones.length ? `Phone numbers: ${phones.join(", ")}.` : "",
    organizations.length ? `Organizations and roles: ${organizations.join(", ")}.` : "",
  ].filter(Boolean).join(" ");

  if (!text.trim()) return [];

  const metadata: MemoryChunkMetadata = {
    date: (contact.updatedAt ?? new Date()).toISOString(),
    sourceType: "contact",
    sourceId: contact.contactId,
    sourceTitle: contact.displayName,
    sourceUrl: contact.photoUrl ?? undefined,
    chunkIndex: 0,
    chunkType: "general_note",
    people: [contact.displayName],
    projects: organizations,
    tags: ["google", "contacts"],
    importance: 3,
  };

  return [
    {
      userId,
      sourceType: "contact",
      sourceId: contact.contactId,
      chunkIndex: 0,
      chunkType: "general_note",
      text,
      evidence: text.slice(0, 400),
      metadata,
      occurredAt: contact.updatedAt ?? new Date(),
    },
  ];
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
