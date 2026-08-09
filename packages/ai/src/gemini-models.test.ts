import assert from "node:assert/strict";
import test from "node:test";
import {
  getGeminiAnswerModel,
  getGeminiChunkModel,
  getGeminiVisionModel,
} from "./gemini-models.ts";

test("Gemini-compatible vision model strips provider prefix for Google SDK paths", () => {
  const previousVisionModel = process.env.TUTURUUU_VISION_MODEL;
  const previousGeminiVisionModel = process.env.GEMINI_VISION_MODEL;

  process.env.TUTURUUU_VISION_MODEL = "google/gemini-3.6-flash";
  delete process.env.GEMINI_VISION_MODEL;

  try {
    assert.equal(getGeminiVisionModel(), "gemini-3.6-flash");
  } finally {
    if (previousVisionModel === undefined) delete process.env.TUTURUUU_VISION_MODEL;
    else process.env.TUTURUUU_VISION_MODEL = previousVisionModel;

    if (previousGeminiVisionModel === undefined) delete process.env.GEMINI_VISION_MODEL;
    else process.env.GEMINI_VISION_MODEL = previousGeminiVisionModel;
  }
});

test("Tuturuuu response models keep provider prefix", () => {
  const previousAnswerModel = process.env.TUTURUUU_ANSWER_MODEL;
  const previousChunkModel = process.env.TUTURUUU_CHUNK_MODEL;

  process.env.TUTURUUU_ANSWER_MODEL = "gemini-3.6-flash";
  process.env.TUTURUUU_CHUNK_MODEL = "gemini-3.6-flash";

  try {
    assert.equal(getGeminiAnswerModel(), "google/gemini-3.6-flash");
    assert.equal(getGeminiChunkModel(), "google/gemini-3.6-flash");
  } finally {
    if (previousAnswerModel === undefined) delete process.env.TUTURUUU_ANSWER_MODEL;
    else process.env.TUTURUUU_ANSWER_MODEL = previousAnswerModel;

    if (previousChunkModel === undefined) delete process.env.TUTURUUU_CHUNK_MODEL;
    else process.env.TUTURUUU_CHUNK_MODEL = previousChunkModel;
  }
});
