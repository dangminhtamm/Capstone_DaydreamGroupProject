import assert from "node:assert/strict";
import test from "node:test";
import {
  getTuturuuuAnswerModel,
  getTuturuuuChunkModel,
  getTuturuuuTranscriptionModel,
  getTuturuuuVisionModel,
} from "./tuturuuu-models.ts";

test("Tuturuuu vision model keeps provider prefix for Responses API paths", () => {
  const previousVisionModel = process.env.TUTURUUU_VISION_MODEL;

  process.env.TUTURUUU_VISION_MODEL = "google/gemini-3.5-flash-lite";

  try {
    assert.equal(getTuturuuuVisionModel(), "google/gemini-3.5-flash-lite");
  } finally {
    if (previousVisionModel === undefined) delete process.env.TUTURUUU_VISION_MODEL;
    else process.env.TUTURUUU_VISION_MODEL = previousVisionModel;
  }
});

test("Tuturuuu transcription model supports an explicit override", () => {
  const previousTranscriptionModel = process.env.TUTURUUU_TRANSCRIPTION_MODEL;
  const previousVisionModel = process.env.TUTURUUU_VISION_MODEL;

  process.env.TUTURUUU_TRANSCRIPTION_MODEL = "gemini-3.5-flash-lite";
  process.env.TUTURUUU_VISION_MODEL = "gemini-3.6-flash";

  try {
    assert.equal(
      getTuturuuuTranscriptionModel(),
      "google/gemini-3.5-flash-lite",
    );
  } finally {
    if (previousTranscriptionModel === undefined) delete process.env.TUTURUUU_TRANSCRIPTION_MODEL;
    else process.env.TUTURUUU_TRANSCRIPTION_MODEL = previousTranscriptionModel;

    if (previousVisionModel === undefined) delete process.env.TUTURUUU_VISION_MODEL;
    else process.env.TUTURUUU_VISION_MODEL = previousVisionModel;
  }
});

test("Tuturuuu response models keep provider prefix", () => {
  const previousAnswerModel = process.env.TUTURUUU_ANSWER_MODEL;
  const previousChunkModel = process.env.TUTURUUU_CHUNK_MODEL;

  process.env.TUTURUUU_ANSWER_MODEL = "gemini-3.5-flash-lite";
  process.env.TUTURUUU_CHUNK_MODEL = "gemini-3.5-flash-lite";

  try {
    assert.equal(getTuturuuuAnswerModel(), "google/gemini-3.5-flash-lite");
    assert.equal(getTuturuuuChunkModel(), "google/gemini-3.5-flash-lite");
  } finally {
    if (previousAnswerModel === undefined) delete process.env.TUTURUUU_ANSWER_MODEL;
    else process.env.TUTURUUU_ANSWER_MODEL = previousAnswerModel;

    if (previousChunkModel === undefined) delete process.env.TUTURUUU_CHUNK_MODEL;
    else process.env.TUTURUUU_CHUNK_MODEL = previousChunkModel;
  }
});
