import { test } from "node:test";
import assert from "node:assert/strict";
import { indexMemoryFromDrive } from "./drive-indexer.ts";

test("indexMemoryFromDrive creates file chunks with Drive citations", async () => {
  const inserted: any[] = [];
  const result = await indexMemoryFromDrive({
    userId: "user-1",
    driveFileId: "drive-file-1",
    externalId: "google-drive-file-1",
    name: "Capstone Notes.txt",
    mimeType: "text/plain",
    extractedText: "Linh said citations must be clear. The team should verify source cards.",
    webViewLink: "https://drive.google.com/file/d/google-drive-file-1/view",
    modifiedTime: new Date("2026-07-23T10:00:00.000Z"),
    embeddingProvider: {
      embedDocument: async () => Array.from({ length: 768 }, () => 0.01),
    },
    insertChunks: async (chunks) => {
      inserted.push(...chunks);
    },
  });

  assert.equal(result.chunkCount, 1);
  assert.equal(inserted[0].sourceType, "drive");
  assert.equal(inserted[0].metadata.sourceTitle, "Capstone Notes.txt");
  assert.equal(inserted[0].metadata.sourceUrl, "https://drive.google.com/file/d/google-drive-file-1/view");
  assert.match(inserted[0].text, /citations must be clear/);
});
