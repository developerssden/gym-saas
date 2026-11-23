/** Expense categories, in the order owners see them. Values match the ExpenseCategory enum. */
export const EXPENSE_CATEGORIES = [
  { value: "RENT", label: "Rent" },
  { value: "UTILITIES", label: "Utilities (electricity, gas, water)" },
  { value: "SALARIES", label: "Salaries" },
  { value: "EQUIPMENT_REPAIRS", label: "Equipment & repairs" },
  { value: "OTHER", label: "Other" },
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]["value"];

const CATEGORY_VALUES = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.value));

export function isExpenseCategory(value: unknown): value is ExpenseCategoryValue {
  return typeof value === "string" && CATEGORY_VALUES.has(value);
}

/** Short label for tables, e.g. "Utilities" rather than the long form. */
export function expenseCategoryLabel(value: string): string {
  const found = EXPENSE_CATEGORIES.find((c) => c.value === value);
  return found ? found.label.replace(/ \(.*\)$/, "") : value;
}

export const MAX_EXPENSE_NOTE = 300;

/** Returns a user-facing error, or null when the expense makes sense. */
export function validateExpenseInput(input: {
  amount: unknown;
  category: unknown;
  note?: unknown;
}): string | null {
  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) return "Amount must be a whole number greater than 0";
  if (!isExpenseCategory(input.category)) return "Choose a category";
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== "string") return "Note must be text";
    if (input.note.length > MAX_EXPENSE_NOTE) return `Keep the note under ${MAX_EXPENSE_NOTE} characters`;
  }
  return null;
}

/** Profit for a period: money collected from members minus expenses. Can be negative. */
export function profit(collected: number, expenses: number): number {
  return collected - expenses;
}

/** Where an expense belongs: its branch, or the whole gym when it has none. */
export function expenseBranchLabel(location: { name: string } | null | undefined): string {
  return location?.name ?? "All branches";
}

/** Shown under "All branches" so owners know what it means. */
export const WHOLE_GYM_HINT = "For the whole gym, not one branch";
