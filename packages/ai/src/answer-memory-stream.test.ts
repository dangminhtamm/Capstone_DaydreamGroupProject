import test from "node:test";
import assert from "node:assert/strict";
import { answerMemoryStream } from "./answer-memory-stream.ts";

test("answerMemoryStream streams the canonical answerMemory result", async () => {
  const result = await answerMemoryStream("   ", "user-1", {} as never, {
    responseLanguage: "vi",
    streamChunkChars: 16,
  });

  assert.equal(result.answer, "Bạn chưa nhập câu hỏi.");
  assert.equal(result.noMemory, true);
  assert.equal(result.answerMode, "no_memory");
  assert.deepEqual(result.citations, []);

  const reader = result.stream.getReader();
  let streamedText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    streamedText += value;
  }

  assert.equal(streamedText, result.answer);
});
