// The fee last used for each membership length at a gym, kept on this device so
// the next membership or renewal of the same length is pre-filled. Per-device
// convenience only: never the source of truth for prices.

export const MEMBERSHIP_LENGTHS = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "1 year" },
] as const;

const key = (gymId: string, months: number) => `kettlio:last-fee:${gymId}:${months}`;

export function readLastFee(gymId: string | null | undefined, months: number): string {
  if (!gymId) return "";
  try {
    return window.localStorage.getItem(key(gymId, months)) ?? "";
  } catch {
    return "";
  }
}

export function saveLastFee(gymId: string | null | undefined, months: number, price: number) {
  if (!gymId || !Number.isInteger(price) || price <= 0) return;
  try {
    window.localStorage.setItem(key(gymId, months), String(price));
  } catch {
    // Private mode or storage blocked: nothing to remember.
  }
}

/** "1 month", "3 months", "1 year", "2 years". */
export function lengthLabel(months: number): string {
  if (months % 12 === 0) return months === 12 ? "1 year" : `${months / 12} years`;
  return months === 1 ? "1 month" : `${months} months`;
}
