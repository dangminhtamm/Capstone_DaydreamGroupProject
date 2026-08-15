import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSummaryDateTime,
  getSummaryPeriod,
  isLastLocalDayOfMonth,
  resolveSummaryTimeZone,
} from "./summary-period.ts";

test("getSummaryPeriod uses configured timezone for daily boundaries", () => {
  const period = getSummaryPeriod(
    "daily",
    new Date("2026-08-06T18:00:00.000Z"),
    "Asia/Ho_Chi_Minh",
  );

  assert.equal(period.localStart, "2026-08-07");
  assert.equal(period.localEnd, "2026-08-07");
  assert.equal(period.start.toISOString(), "2026-08-06T17:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-08-07T16:59:59.999Z");
});

test("getSummaryPeriod uses local Monday for weekly summaries", () => {
  const period = getSummaryPeriod(
    "weekly",
    new Date("2026-08-09T15:00:00.000Z"),
    "Asia/Ho_Chi_Minh",
  );

  assert.equal(period.localStart, "2026-08-03");
  assert.equal(period.localEnd, "2026-08-09");
  assert.equal(period.start.toISOString(), "2026-08-02T17:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-08-09T16:59:59.999Z");
});

test("getSummaryPeriod uses local month and year boundaries", () => {
  const monthly = getSummaryPeriod(
    "monthly",
    new Date("2026-08-15T10:00:00.000Z"),
    "Asia/Ho_Chi_Minh",
  );
  const yearly = getSummaryPeriod(
    "yearly",
    new Date("2026-08-15T10:00:00.000Z"),
    "Asia/Ho_Chi_Minh",
  );

  assert.equal(monthly.localStart, "2026-08-01");
  assert.equal(monthly.localEnd, "2026-08-31");
  assert.equal(monthly.start.toISOString(), "2026-07-31T17:00:00.000Z");
  assert.equal(monthly.end.toISOString(), "2026-08-31T16:59:59.999Z");
  assert.equal(yearly.localStart, "2026-01-01");
  assert.equal(yearly.localEnd, "2026-12-31");
  assert.equal(yearly.start.toISOString(), "2025-12-31T17:00:00.000Z");
  assert.equal(yearly.end.toISOString(), "2026-12-31T16:59:59.999Z");
});

test("isLastLocalDayOfMonth checks the configured local date", () => {
  assert.equal(
    isLastLocalDayOfMonth(new Date("2026-08-31T16:58:00.000Z"), "Asia/Ho_Chi_Minh"),
    true,
  );
  assert.equal(
    isLastLocalDayOfMonth(new Date("2026-08-31T17:01:00.000Z"), "Asia/Ho_Chi_Minh"),
    false,
  );
});

test("summary timezone helpers fallback safely to UTC", () => {
  assert.equal(resolveSummaryTimeZone("not-a-timezone"), "UTC");
  assert.equal(
    formatSummaryDateTime(new Date("2026-08-06T18:00:00.000Z"), "not-a-timezone"),
    "2026-08-06 18:00:00 UTC",
  );
});
