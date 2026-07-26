import { test } from "node:test";
import assert from "node:assert/strict";
import { indexMemoryFromGmail } from "./gmail-indexer.ts";

test("indexMemoryFromGmail creates email chunks with Gmail citation metadata", async () => {
  const inserted: any[] = [];
  const result = await indexMemoryFromGmail({
    userId: "user-1",
    message: {
      messageId: "gmail-message-1",
      externalId: "18fb-example",
      threadId: "thread-1",
      sender: "Linh Mentor <linh@example.com>",
      subject: "Capstone feedback",
      snippet: "Every AI answer should show clear citations.",
      body: "The Second Brain demo should prove grounded search, readable source cards, and stable Calendar linking.",
      receivedAt: new Date("2026-07-24T09:00:00.000Z"),
    },
    embeddingProvider: {
      embedDocument: async () => Array.from({ length: 768 }, () => 0.01),
    },
    insertChunks: async (chunks) => {
      inserted.push(...chunks);
    },
  });

  assert.equal(result.sourceType, "gmail");
  assert.equal(result.chunkCount, 1);
  assert.equal(inserted[0].sourceType, "gmail");
  assert.equal(inserted[0].metadata.sourceTitle, "Capstone feedback");
  assert.equal(inserted[0].metadata.sourceUrl, "https://mail.google.com/mail/u/0/#all/18fb-example");
  assert.match(inserted[0].text, /Gmail email from Linh Mentor/);
  assert.match(inserted[0].text, /grounded search/);
});
