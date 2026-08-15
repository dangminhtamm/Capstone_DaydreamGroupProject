import assert from "node:assert/strict";
import test from "node:test";
import { extractEntityQueryTerms } from "./retrieval.ts";

test("extractEntityQueryTerms keeps names and project identifiers", () => {
  assert.deepEqual(
    extractEntityQueryTerms("What feedback did Linh send about Capstone Alpha?"),
    ["linh", "capstone", "alpha"],
  );
});

test("extractEntityQueryTerms normalizes Vietnamese accents", () => {
  assert.deepEqual(
    extractEntityQueryTerms("Quân và Đức đã làm gì trong dự án Daydream?"),
    ["quan", "duc", "daydream"],
  );
});
