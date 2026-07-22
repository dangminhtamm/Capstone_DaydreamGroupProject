import test from "node:test";
import assert from "node:assert/strict";
import {
  extractEntityMentionsFromMetadata,
  splitTextByBoundary,
  withEmbeddings,
} from "./indexing-utils.ts";

test("splitTextByBoundary keeps chunks within the requested size", () => {
  const chunks = splitTextByBoundary(
    "First sentence is short. Second sentence has enough words to create a useful boundary. Third sentence ends the note.",
    55,
  );

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 55));
  assert.match(chunks[0] ?? "", /First sentence is short/);
});

test("withEmbeddings preserves chunk order while embedding", async () => {
  const chunks = await withEmbeddings(
    [{ text: "alpha" }, { text: "beta" }, { text: "gamma" }],
    {
      embedDocument: async (text) => [text.length],
    },
  );

  assert.deepEqual(
    chunks.map((chunk) => chunk.text),
    ["alpha", "beta", "gamma"],
  );
  assert.deepEqual(
    chunks.map((chunk) => chunk.embedding),
    [[5], [4], [5]],
  );
});

test("extractEntityMentionsFromMetadata normalizes tag and habit values", () => {
  const mentions = extractEntityMentionsFromMetadata({
    date: "2026-07-19T00:00:00.000Z",
    sourceType: "diary",
    sourceId: "diary-1",
    chunkIndex: 0,
    chunkType: "reflection",
    people: [" Linh "],
    projects: [" AI Memory "],
    tags: [" Demo "],
    goals: ["Finish Capstone"],
    habits: [" Weekly Review "],
    importance: 4,
  });

  assert.deepEqual(mentions, [
    { entityType: "person", entityValue: "Linh" },
    { entityType: "project", entityValue: "AI Memory" },
    { entityType: "tag", entityValue: "demo" },
    { entityType: "goal", entityValue: "Finish Capstone" },
    { entityType: "habit", entityValue: "weekly review" },
  ]);
});
