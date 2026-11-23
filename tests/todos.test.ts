import { test } from "node:test";
import assert from "node:assert/strict";
import { dueDay, dueState, dueText, parseDueDay, validateTodoInput } from "@/lib/todos";

const now = new Date(2026, 10, 23, 15, 0); // 23 Nov 2026, device time
const due = (day: string) => `${day}T00:00:00.000Z`;

test("due dates are calendar days, stored as UTC midnight", () => {
  assert.deepEqual(parseDueDay("2026-11-25"), new Date("2026-11-25T00:00:00.000Z"));
  assert.equal(parseDueDay(""), null);
  assert.equal(parseDueDay(null), null);
  assert.equal(parseDueDay(undefined), null);
  assert.equal(parseDueDay("2026-02-31"), "invalid");
  assert.equal(parseDueDay("25/11/2026"), "invalid");
  assert.equal(dueDay(due("2026-11-25")), "2026-11-25");
});

test("due state compares with the device's today", () => {
  assert.equal(dueState(due("2026-11-20"), now), "overdue");
  assert.equal(dueState(due("2026-11-23"), now), "today");
  assert.equal(dueState(due("2026-11-24"), now), "tomorrow");
  assert.equal(dueState(due("2026-12-01"), now), "later");
});

test("due text", () => {
  assert.equal(dueText(due("2026-11-20"), now), "Overdue · 20 Nov 2026");
  assert.equal(dueText(due("2026-11-23"), now), "Today");
  assert.equal(dueText(due("2026-11-24"), now), "Tomorrow");
  assert.equal(dueText(due("2026-12-01"), now), "1 Dec 2026");
});

test("input: a title is needed, notes and due date are optional", () => {
  assert.equal(validateTodoInput({ title: "Order towels" }), null);
  assert.equal(validateTodoInput({ title: "Order towels", description: "", due_date: "" }), null);
  assert.equal(validateTodoInput({ title: "   " }), "Write what needs doing");
  assert.equal(validateTodoInput({ title: "x".repeat(201) }), "Keep it under 200 characters");
  assert.equal(validateTodoInput({ title: "Ok", due_date: "soon" }), "Pick a real date for the due date");
  // Updates may leave the title out.
  assert.equal(validateTodoInput({ due_date: null }), null);
});
