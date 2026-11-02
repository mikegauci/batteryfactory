import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addDays, maltaDay, salesSummary } from "../src/lib/admin/analytics.ts";
const order = (
  id,
  created_at,
  status = "completed",
  total_cents = 1000,
  currency = "EUR",
) => ({ id, created_at, status, total_cents, currency });
test("revenue excludes unpaid, failed, cancelled, refunded and foreign-currency orders", () => {
  const result = salesSummary(
    [
      order("1", "2026-10-29T10:00:00Z"),
      order("2", "2026-10-29T11:00:00Z", "processing", 2000),
      ...["pending", "failed", "cancelled", "refunded"].map((s) =>
        order(s, "2026-10-29T12:00:00Z", s, 9000),
      ),
      order("usd", "2026-10-29T12:00:00Z", "completed", 9000, "USD"),
    ],
    "2026-10-29",
    7,
  );
  assert.equal(result.revenue, 3000);
  assert.equal(result.paid, 2);
  assert.equal(result.average, 1500);
  assert.equal(result.total, 6);
  assert.equal(result.pending, 1);
  assert.equal(
    result.series.reduce((n, p) => n + p.revenue, 0),
    result.revenue,
  );
});
test("Malta midnight, daylight saving and period boundaries", () => {
  assert.equal(maltaDay(new Date("2026-10-24T22:30:00Z")), "2026-10-25");
  assert.equal(maltaDay(new Date("2026-10-25T22:30:00Z")), "2026-10-25");
  const result = salesSummary(
    [
      order("previous", "2026-10-22T10:00:00Z", "completed", 2000),
      order("start", "2026-10-22T22:30:00Z", "completed", 3000),
      order("last", "2026-10-29T22:59:00Z", "completed", 4000),
      order("future", "2026-10-29T23:00:00Z", "completed", 5000),
      order("old", "2026-10-15T10:00:00Z", "completed", 6000),
    ],
    "2026-10-29",
    7,
  );
  assert.equal(result.start, "2026-10-23");
  assert.equal(result.revenue, 7000);
  assert.equal(result.previousRevenue, 2000);
  assert.equal(result.series.length, 7);
});
test("empty periods and calendar arithmetic cross leap/year boundaries", () => {
  const result = salesSummary([], "2026-01-01", 30);
  assert.equal(result.average, 0);
  assert.equal(result.revenue, 0);
  assert.equal(result.series.length, 30);
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});
