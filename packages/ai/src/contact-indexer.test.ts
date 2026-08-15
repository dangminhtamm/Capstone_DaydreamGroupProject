import { test } from "node:test";
import assert from "node:assert/strict";
import { indexMemoryFromContact } from "./contact-indexer.ts";

test("indexMemoryFromContact creates grounded contact chunks without Tuturuuu generation", async () => {
  const inserted: any[] = [];
  const result = await indexMemoryFromContact({
    userId: "user-1",
    contacts: [
      {
        contactId: "contact-1",
        externalId: "people/contact-1",
        displayName: "Linh Mentor",
        emailAddresses: ["linh@example.com"],
        phoneNumbers: ["+84 900 000 001"],
        organizations: ["RMIT", "Mentor"],
        updatedAt: new Date("2026-07-22T10:00:00.000Z"),
      },
    ],
    embeddingProvider: {
      embedDocument: async () => Array.from({ length: 768 }, () => 0.01),
    },
    insertChunks: async (chunks) => {
      inserted.push(...chunks);
    },
  });

  assert.equal(result.indexedContactCount, 1);
  assert.equal(result.totalChunkCount, 1);
  assert.equal(inserted[0].sourceType, "contact");
  assert.match(inserted[0].text, /Google contact: Linh Mentor/);
  assert.match(inserted[0].text, /linh@example\.com/);
  assert.deepEqual(inserted[0].metadata.people, ["Linh Mentor"]);
});
