// Equipment labels and maintenance state (pure, safe for tests and the browser).
import { differenceInCalendarDays } from "date-fns";

export const EQUIPMENT_CATEGORIES = [
  { value: "CARDIO", label: "Cardio" },
  { value: "STRENGTH", label: "Strength machines" },
  { value: "FREE_WEIGHTS", label: "Free weights" },
  { value: "ACCESSORIES", label: "Accessories" },
  { value: "CONSUMABLES", label: "Consumables" },
] as const;

export const EQUIPMENT_CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "GOOD", label: "Good" },
  { value: "NEEDS_MAINTENANCE", label: "Needs repair" },
  { value: "OUT_OF_ORDER", label: "Out of order" },
] as const;

export const EQUIPMENT_STATUSES = [
  { value: "ACTIVE", label: "In use" },
  { value: "IN_REPAIR", label: "Being repaired" },
  { value: "RETIRED", label: "Retired" },
] as const;

export type EquipmentCategoryValue = (typeof EQUIPMENT_CATEGORIES)[number]["value"];
export type EquipmentConditionValue = (typeof EQUIPMENT_CONDITIONS)[number]["value"];
export type EquipmentStatusValue = (typeof EQUIPMENT_STATUSES)[number]["value"];

const labelIn = (list: ReadonlyArray<{ value: string; label: string }>, value: string | null | undefined) =>
  value ? (list.find((x) => x.value === value)?.label ?? value) : null;

export const equipmentCategoryLabel = (v: string | null | undefined) => labelIn(EQUIPMENT_CATEGORIES, v);
export const equipmentConditionLabel = (v: string | null | undefined) => labelIn(EQUIPMENT_CONDITIONS, v);
export const equipmentStatusLabel = (v: string | null | undefined) => labelIn(EQUIPMENT_STATUSES, v);

/**
 * The database still needs a "type"; the short form doesn't ask for one, so
 * it's the category's name (or "Other").
 */
export function defaultEquipmentType(type: unknown, category: unknown): string {
  if (typeof type === "string" && type.trim()) return type.trim();
  return equipmentCategoryLabel(typeof category === "string" ? category : null) ?? "Other";
}

export const MAINTENANCE_SOON_DAYS = 7;

export type MaintenanceState =
  | { kind: "none" }
  | { kind: "overdue"; days: number }
  | { kind: "soon"; days: number }
  | { kind: "later"; days: number };

/** Whether maintenance is overdue, due within a week, or later. Retired items need none. */
export function maintenanceState(
  nextDue: string | Date | null | undefined,
  status: string | null | undefined,
  now: Date = new Date()
): MaintenanceState {
  if (!nextDue || status === "RETIRED") return { kind: "none" };
  const days = differenceInCalendarDays(new Date(nextDue), now);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days <= MAINTENANCE_SOON_DAYS) return { kind: "soon", days };
  return { kind: "later", days };
}

/** "Overdue by 3 days", "Due today", "Due in 5 days"; null when nothing to say. */
export function maintenanceText(state: MaintenanceState): string | null {
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  if (state.kind === "overdue") return `Overdue by ${days(state.days)}`;
  if (state.kind === "soon") return state.days === 0 ? "Due today" : `Due in ${days(state.days)}`;
  return null;
}
