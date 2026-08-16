import assert from "node:assert/strict";
import { test } from "node:test";
import { getDaysInMonth, getDaysInYear, toDateKey } from "./yearly-activity.ts";

test("yearly activity exposes at least 365 day nodes", () => {
  assert.equal(getDaysInYear(2026), 365);
  assert.equal(getDaysInYear(2024), 366);
});

test("yearly activity builds stable local date keys", () => {
  assert.equal(getDaysInMonth(2024, 1), 29);
  assert.equal(getDaysInMonth(2026, 1), 28);
  assert.equal(toDateKey(2026, 0, 5), "2026-01-05");
});
