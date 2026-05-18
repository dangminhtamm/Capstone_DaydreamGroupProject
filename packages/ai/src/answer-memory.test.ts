import assert from "node:assert/strict";
import { test } from "node:test";
import { answerFromChunks, inferRetrievalFilters } from "./answer-memory.ts";
import type { MemorySearchHit } from "./retrieval.ts";

test("inferRetrievalFilters prefers calendar sources for calendar questions", () => {
  const filters = inferRetrievalFilters("When was the Backend API Check scheduled?");

  assert.deepEqual(filters.preferredSourceTypes, ["calendar"]);
  assert.ok(filters.preferredChunkTypes?.includes("event"));
});

test("inferRetrievalFilters prefers action-item chunks for task questions", () => {
  const filters = inferRetrievalFilters("What remaining tasks do I need to follow up on?");

  assert.deepEqual(filters.preferredSourceTypes, ["diary"]);
  assert.ok(filters.preferredChunkTypes?.includes("action_item"));
});

test("answerFromChunks does not attach citations when top similarity is too low", async () => {
  const result = await answerFromChunks(
    "What did I do today?",
    [
      makeHit({
        similarity: 0.2,
        text: "A weakly related memory",
      }),
    ],
    { minTopSimilarity: 0.55 },
  );

  assert.equal(result.confidence, "low");
  assert.equal(result.citations.length, 0);
});

function makeHit(overrides: Partial<MemorySearchHit>): MemorySearchHit {
  return {
    id: "chunk-1",
    sourceType: "diary",
    sourceId: "diary-1",
    chunkType: "general",
    text: "Memory text",
    evidence: null,
    metadata: {},
    occurredAt: new Date("2026-05-18T09:00:00.000Z"),
    distance: 0.8,
    vectorSimilarity: 0.2,
    lexicalScore: 0,
    retrievalMode: "vector",
    similarity: 0.2,
    ...overrides,
  };
}
