import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSemanticChunkType } from "./chunker.ts";

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
