// Shared display formats for the app: one date format everywhere and plain
// labels for enum values. Never show raw codes (MONTHLY, BANK_TRANSFER, …) or
// toLocaleDateString() output, which is M/D/Y on many phones.
import { format } from "date-fns";

type DateInput = Date | string | number | null | undefined;

function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `22 Nov 2026`, or `fallback` ("—") when missing or invalid. */
export function formatDate(value: DateInput, fallback = "—"): string {
  const d = toValidDate(value);
  return d ? format(d, "d MMM yyyy") : fallback;
}

/** `22 Nov 2026, 3:05 pm`, or `fallback` when missing or invalid. */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toValidDate(value);
  return d ? `${format(d, "d MMM yyyy")}, ${format(d, "h:mm aaa")}` : fallback;
}

/** `22 Nov`: for ranges and lists where the year is obvious. */
export function formatShortDate(value: DateInput, fallback = "—"): string {
  const d = toValidDate(value);
  return d ? format(d, "d MMM") : fallback;
}

/** `1 Nov – 30 Nov 2026`, keeping the year only on the end when both share it. */
export function formatDateRange(start: DateInput, end: DateInput, fallback = "—"): string {
  const s = toValidDate(start);
  const e = toValidDate(end);
  if (!s || !e) return s ? formatDate(s) : e ? formatDate(e) : fallback;
  const startText = s.getFullYear() === e.getFullYear() ? formatShortDate(s) : formatDate(s);
  return `${startText} – ${formatDate(e)}`;
}

const titleCase = (code: string) =>
  code
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .join(" ")
    .replace(/^./, c => c.toUpperCase());

/** Label for a known code, or a readable version of an unknown one ("SOME_CODE" → "Some code"). */
function labelFrom(labels: Record<string, string>, value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  return labels[value] ?? titleCase(value);
}

const BILLING_MODEL_LABELS: Record<string, string> = { MONTHLY: "Monthly", YEARLY: "Yearly" };
export const billingModelLabel = (value: string | null | undefined) => labelFrom(BILLING_MODEL_LABELS, value);

const PAYMENT_METHOD_LABELS: Record<string, string> = { CASH: "Cash", BANK_TRANSFER: "Bank transfer" };
export const paymentMethodLabel = (value: string | null | undefined) => labelFrom(PAYMENT_METHOD_LABELS, value);

const SUBSCRIPTION_TYPE_LABELS: Record<string, string> = { MEMBER: "Member fee", OWNER: "Gym plan" };
export const subscriptionTypeLabel = (value: string | null | undefined) => labelFrom(SUBSCRIPTION_TYPE_LABELS, value);

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Admin",
  GYM_OWNER: "Owner",
  STAFF: "Staff",
  MEMBER: "Member",
};
export const roleLabel = (value: string | null | undefined) => labelFrom(ROLE_LABELS, value);

const EQUIPMENT_STATUS_LABELS: Record<string, string> = { ACTIVE: "In use", IN_REPAIR: "In repair", RETIRED: "Retired" };
export const equipmentStatusLabel = (value: string | null | undefined) => labelFrom(EQUIPMENT_STATUS_LABELS, value);

/** Readable label for any other enum-like code. */
export const codeLabel = (value: string | null | undefined, fallback = "—") => labelFrom({}, value, fallback);
