// packages/ai/src/calendar-indexer.ts
//
// Transforms Google Calendar events into memory chunks for AI retrieval.
// Unlike diary entries which need LLM-based semantic chunking, calendar events
// are already structured, so we directly create chunks from their fields.
// This avoids unnecessary generative AI calls and keeps indexing fast + cheap.

import { insertMemoryChunks } from "@second-brain/db";
import {
  createDefaultEmbeddingProvider,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import { withEmbeddings } from "./indexing-utils.ts";
import type { PersistedMemoryChunkPayload } from "./memory-indexer.ts";
import { withMemoryDate, type MemoryChunkMetadata } from "./types.ts";

export interface CalendarEventInput {
  /** The calendar_events.id (DB primary key) */
  eventId: string;
  /** Google Calendar external_id */
  externalId: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  htmlLink?: string | null;
}

export interface IndexMemoryFromCalendarInput {
  userId: string;
  events: CalendarEventInput[];
  embeddingProvider?: Pick<AdvancedEmbeddingProvider, "embedDocument">;
  insertChunks?: (chunks: PersistedMemoryChunkPayload[]) => Promise<unknown>;
}

export interface IndexMemoryFromCalendarResult {
  sourceType: "calendar";
  indexedEventCount: number;
  totalChunkCount: number;
  /** Events that failed to index (non-fatal) */
  errors: Array<{ eventId: string; error: string }>;
}

/**
 * Index multiple calendar events into memory chunks.
 *
 * Each event produces 1–2 chunks:
 *   - Chunk 0: A concise event summary sentence (always created)
 *   - Chunk 1: The full event description (only if description exists)
 *
 * This design means simple events like "Team standup at 9am" get a single
 * chunk, while detailed events with agendas get both a quick-recall chunk
 * and a detail chunk.
 */
export async function indexMemoryFromCalendar(
  input: IndexMemoryFromCalendarInput,
): Promise<IndexMemoryFromCalendarResult> {
  if (!input.events.length) {
    return {
      sourceType: "calendar",
      indexedEventCount: 0,
      totalChunkCount: 0,
      errors: [],
    };
  }

  const embeddingProvider =
    input.embeddingProvider ?? createDefaultEmbeddingProvider();
  const doInsert = input.insertChunks ?? insertMemoryChunks;

  const errors: Array<{ eventId: string; error: string }> = [];
  let totalChunkCount = 0;

  for (const event of input.events) {
    try {
      const chunks = buildCalendarChunks(input.userId, event);
      if (!chunks.length) continue;

      const persistedChunks: PersistedMemoryChunkPayload[] = await withEmbeddings(
        chunks,
        embeddingProvider,
      );

      await doInsert(persistedChunks);
      totalChunkCount += persistedChunks.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ eventId: event.eventId, error: message });
      console.error(
        `[CalendarIndexer] Failed to index event ${event.eventId}: ${message}`,
      );
    }
  }

  return {
    sourceType: "calendar",
    indexedEventCount: input.events.length - errors.length,
    totalChunkCount,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildCalendarChunks(
  userId: string,
  event: CalendarEventInput,
): Omit<PersistedMemoryChunkPayload, "embedding">[] {
  const chunks: Omit<PersistedMemoryChunkPayload, "embedding">[] = [];

  const dateStr = formatEventDate(event.startTime);
  const timeRange = formatTimeRange(event.startTime, event.endTime);

  // Chunk 0: Event summary sentence — designed for high recall on questions
  // like "What meetings do I have next week?" or "When is the standup?"
  const summaryText = buildSummaryText(event.title, dateStr, timeRange);
  const baseMetadata: MemoryChunkMetadata = withMemoryDate({
    date: event.startTime.toISOString(),
    sourceType: "calendar",
    sourceId: event.eventId,
    sourceTitle: event.title,
    chunkIndex: 0,
    chunkType: "event",
    calendarEventId: event.externalId,
    sourceUrl: event.htmlLink ?? undefined,
    tags: ["calendar"],
    people: [],
    projects: [],
    importance: 3,
  });

  chunks.push({
    userId,
    sourceType: "calendar",
    sourceId: event.eventId,
    chunkIndex: 0,
    chunkType: "event",
    text: summaryText,
    evidence: event.title,
    metadata: baseMetadata,
    occurredAt: event.startTime,
  });

  // Chunk 1: Full description (only if meaningful content exists)
  const description = event.description?.trim();
  if (description && description.length > 10) {
    // Strip HTML tags from Google Calendar descriptions
    const cleanDescription = stripHtml(description);

    if (cleanDescription.length > 10) {
      chunks.push({
        userId,
        sourceType: "calendar",
        sourceId: event.eventId,
        chunkIndex: 1,
        chunkType: "general",
        text: `Details for "${event.title}" (${dateStr}): ${cleanDescription}`,
        evidence: cleanDescription.slice(0, 400),
        metadata: {
          ...baseMetadata,
          chunkIndex: 1,
          chunkType: "general",
        },
        occurredAt: event.startTime,
      });
    }
  }

  return chunks;
}

function buildSummaryText(
  title: string,
  dateStr: string,
  timeRange: string,
): string {
  return `Calendar event: "${title}" scheduled on ${dateStr}, ${timeRange}.`;
}

function formatEventDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  return `from ${fmt(start)} to ${fmt(end)}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
