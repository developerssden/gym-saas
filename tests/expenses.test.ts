import assert from "node:assert/strict";
import test from "node:test";
import { calendarDayRange, parseCalendarDay } from "@/lib/date-utils";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  isExpenseCategory,
  profit,
  validateExpenseInput,
} from "@/lib/expenses";

test("a Karachi calendar day starts at 19:00 UTC the day before", () => {
  const range = calendarDayRange("2026-11-20", "Asia/Karachi")!;
  assert.equal(range.start.toISOString(), "2026-11-19T19:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-11-20T19:00:00.000Z");
});

test("day ranges work for UTC and for zones behind UTC", () => {
  const utc = calendarDayRange("2026-11-20", "UTC")!;
  assert.equal(utc.start.toISOString(), "2026-11-20T00:00:00.000Z");
  assert.equal(utc.end.toISOString(), "2026-11-21T00:00:00.000Z");

  const ny = calendarDayRange("2026-11-20", "America/New_York")!; // EST, UTC-5
  assert.equal(ny.start.toISOString(), "2026-11-20T05:00:00.000Z");
  assert.equal(ny.end.toISOString(), "2026-11-21T05:00:00.000Z");
});

test("a day with a DST change is 23 hours long", () => {
  const london = calendarDayRange("2026-03-29", "Europe/London")!; // clocks go forward
  assert.equal((london.end.getTime() - london.start.getTime()) / 3_600_000, 23);
});

test("expenses stored by date fall inside their own day's range", () => {
  const stored = parseCalendarDay("2026-11-20")!; // 12:00 UTC
  const range = calendarDayRange("2026-11-20", "Asia/Karachi")!;
  assert.ok(stored >= range.start && stored < range.end);
});

test("invalid days give no range", () => {
  assert.equal(calendarDayRange("2026-02-30"), null);
  assert.equal(calendarDayRange("20-11-2026"), null);
});

test("expense validation", () => {
  assert.equal(validateExpenseInput({ amount: 45000, category: "RENT" }), null);
  assert.equal(validateExpenseInput({ amount: "1200", category: "UTILITIES", note: "K-Electric bill" }), null);
  assert.match(validateExpenseInput({ amount: 0, category: "RENT" })!, /greater than 0/);
  assert.match(validateExpenseInput({ amount: 12.5, category: "RENT" })!, /whole number/);
  assert.match(validateExpenseInput({ amount: "abc", category: "RENT" })!, /whole number/);
  assert.match(validateExpenseInput({ amount: 100, category: "FOOD" })!, /category/);
  assert.match(validateExpenseInput({ amount: 100, category: "OTHER", note: "x".repeat(301) })!, /300/);
});

test("categories and labels", () => {
  assert.equal(EXPENSE_CATEGORIES.length, 5);
  assert.ok(isExpenseCategory("SALARIES"));
  assert.ok(!isExpenseCategory("salaries"));
  assert.equal(expenseCategoryLabel("UTILITIES"), "Utilities");
  assert.equal(expenseCategoryLabel("EQUIPMENT_REPAIRS"), "Equipment & repairs");
});

test("profit is collected minus expenses and can be negative", () => {
  assert.equal(profit(120000, 75000), 45000);
  assert.equal(profit(20000, 50000), -30000);
});
