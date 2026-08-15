import assert from "node:assert/strict";
import test from "node:test";
import {
  generateDeterministicDiaryChunks,
  generateSemanticChunks,
  normalizeSemanticChunkType,
} from "./chunker.ts";

test("normalizeSemanticChunkType maps model aliases to supported chunk types", () => {
  assert.equal(normalizeSemanticChunkType("task"), "action_item");
  assert.equal(normalizeSemanticChunkType("follow-up"), "action_item");
  assert.equal(normalizeSemanticChunkType("mood"), "reflection");
  assert.equal(normalizeSemanticChunkType("meeting"), "event");
  assert.equal(normalizeSemanticChunkType("general_note"), "general");
});

test("normalizeSemanticChunkType defaults unknown values to general", () => {
  assert.equal(normalizeSemanticChunkType("unexpected_type"), "general");
  assert.equal(normalizeSemanticChunkType(null), "general");
});

test("deterministic diary chunks preserve source text without inferred metadata", () => {
  const rawText = `${"I worked on the API and fixed indexing. ".repeat(35)}Final note.`;
  const chunks = generateDeterministicDiaryChunks(rawText, {
    sourceType: "diary",
    sourceId: "diary-1",
    sourceTitle: "Work log",
    date: "2026-08-14T10:00:00.000Z",
  });

  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((chunk) => chunk.text).join(" "), rawText.trim());
  assert.ok(chunks.every((chunk) => chunk.evidence === chunk.text));
  assert.ok(chunks.every((chunk) => chunk.metadata.chunkType === "general"));
  assert.ok(chunks.every((chunk) => chunk.metadata.chunkingMethod === "deterministic_fallback"));
  assert.ok(chunks.every((chunk) => chunk.metadata.people?.length === 0));
});

test("semantic diary chunking falls back deterministically when Tuturuuu fails", async () => {
  let fallbackError: Error | undefined;
  const chunks = await generateSemanticChunks(
    "I reviewed the API. Then I wrote the deployment checklist.",
    {
      sourceType: "diary",
      sourceId: "diary-2",
      sourceTitle: "Daily note",
      date: "2026-08-14T11:00:00.000Z",
    },
    {
      generateWithModel: async () => {
        throw new Error("Tuturuuu service unavailable");
      },
      onFallback: (error) => {
        fallbackError = error;
      },
    },
  );

  assert.equal(fallbackError?.message, "Tuturuuu service unavailable");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.text, "I reviewed the API. Then I wrote the deployment checklist.");
  assert.equal(chunks[0]?.metadata.chunkingMethod, "deterministic_fallback");
});
