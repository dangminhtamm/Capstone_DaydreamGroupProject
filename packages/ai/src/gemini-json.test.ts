import assert from "node:assert/strict";
import { test } from "node:test";
import { parseJsonResponse } from "./gemini-json.ts";

test("parseJsonResponse extracts valid JSON from surrounding prose", () => {
  const parsed = parseJsonResponse(`
Here is the JSON response:

{
  "answer": "Calendar sync is implemented at code level.",
  "confidence": "medium",
  "citations": [
    { "marker": "S1", "claim": "Calendar sync is implemented" }
  ]
}

Hope this helps.
`);

  assert.deepEqual(parsed, {
    answer: "Calendar sync is implemented at code level.",
    confidence: "medium",
    citations: [
      { marker: "S1", claim: "Calendar sync is implemented" },
    ],
  });
});

test("parseJsonResponse strips markdown fences before parsing", () => {
  const parsed = parseJsonResponse(`
\`\`\`json
{
  "answer": "The memory is insufficient.",
  "confidence": "low",
  "citations": []
}
\`\`\`
`);

  assert.deepEqual(parsed, {
    answer: "The memory is insufficient.",
    confidence: "low",
    citations: [],
  });
});

test("parseJsonResponse repairs truncated JSON when possible", () => {
  const parsed = parseJsonResponse(`{
  "answer": "I felt stressed about the demo",
  "confidence": "low",
  "citations": [
    { "marker": "S1", "claim": "felt stressed about the demo" }
  ]
`);

  assert.deepEqual(parsed, {
    answer: "I felt stressed about the demo",
    confidence: "low",
    citations: [
      { marker: "S1", claim: "felt stressed about the demo" },
    ],
  });
});
