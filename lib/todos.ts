// To-do due dates and input checks (pure, for tests, the API and the browser).
// A due date is a calendar day, stored as UTC midnight ("2026-11-25T00:00:00Z").
import { addDays, format } from "date-fns";
import { formatDate } from "@/lib/format";

export const MAX_TODO_TITLE = 200;
export const MAX_TODO_NOTES = 1000;

/** "yyyy-MM-dd" of a stored due date. */
export function dueDay(due: string | Date): string {
  return new Date(due).toISOString().slice(0, 10);
}

/** A "yyyy-MM-dd" day as it is stored, or null when empty or not a real day. */
export function parseDueDay(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid";
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? d : "invalid";
}

export type DueState = "overdue" | "today" | "tomorrow" | "later";

/** Compared with the device's own today. */
export function dueState(due: string | Date, now: Date = new Date()): DueState {
  const day = dueDay(due);
  const today = format(now, "yyyy-MM-dd");
  if (day < today) return "overdue";
  if (day === today) return "today";
  if (day === format(addDays(now, 1), "yyyy-MM-dd")) return "tomorrow";
  return "later";
}

/** "Overdue · 20 Nov 2026", "Today", "Tomorrow", "27 Nov 2026". */
export function dueText(due: string | Date, now: Date = new Date()): string {
  const state = dueState(due, now);
  const [y, m, d] = dueDay(due).split("-").map(Number);
  const date = formatDate(new Date(y, m - 1, d));
  if (state === "overdue") return `Overdue · ${date}`;
  if (state === "today") return "Today";
  if (state === "tomorrow") return "Tomorrow";
  return date;
}

/** An error for the owner, or null when the to-do makes sense. */
export function validateTodoInput(input: { title?: unknown; description?: unknown; due_date?: unknown }): string | null {
  if (input.title !== undefined) {
    if (typeof input.title !== "string" || !input.title.trim()) return "Write what needs doing";
    if (input.title.trim().length > MAX_TODO_TITLE) return `Keep it under ${MAX_TODO_TITLE} characters`;
  }
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") return "Notes must be text";
    if (input.description.length > MAX_TODO_NOTES) return `Keep the notes under ${MAX_TODO_NOTES} characters`;
  }
  if (parseDueDay(input.due_date) === "invalid") return "Pick a real date for the due date";
  return null;
}
