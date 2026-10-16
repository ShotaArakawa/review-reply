import { test } from "node:test";
import assert from "node:assert/strict";
import { consume, currentUsage, monthKey, remaining } from "./usage.ts";

const oct = new Date(2026, 9, 16);
const nov = new Date(2026, 10, 1);

test("月キーは YYYY-MM", () => {
  assert.equal(monthKey(oct), "2026-10");
});

test("使うたびに残り回数が減り、0 未満にならない", () => {
  let u = currentUsage(null, oct);
  assert.equal(remaining(u, "free", oct), 10);
  for (let i = 0; i < 12; i++) u = consume(u, oct);
  assert.equal(u.count, 12);
  assert.equal(remaining(u, "free", oct), 0);
  assert.equal(remaining(u, "pro", oct), 288);
});

test("月が変わるとリセットされる", () => {
  const u = consume(consume(currentUsage(null, oct), oct), oct);
  assert.equal(remaining(u, "free", nov), 10);
  assert.deepEqual(consume(u, nov), { month: "2026-11", count: 1 });
});
