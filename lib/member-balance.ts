/**
 * Money owed on a Member Subscription.
 *
 *   amount due = price - discount + admission fee
 *   paid       = sum of the subscription's payments
 *   balance    = amount due - paid   (never below 0; any excess is "overpaid")
 *
 * All amounts are whole currency units (Int columns), like the rest of the app.
 */

export type FeeBreakdown = {
  price: number;
  discount?: number | null;
  admission_fee?: number | null;
};

export type BalanceSummary = {
  amount_due: number;
  amount_paid: number;
  balance: number;
  overpaid: number;
};

export function amountDue(fee: FeeBreakdown): number {
  const price = fee.price ?? 0;
  const discount = Math.min(Math.max(fee.discount ?? 0, 0), price);
  return price - discount + Math.max(fee.admission_fee ?? 0, 0);
}

export function summarizeBalance(
  fee: FeeBreakdown,
  payments: ReadonlyArray<{ amount: number | null | undefined }> = []
): BalanceSummary {
  const amount_due = amountDue(fee);
  const amount_paid = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  return {
    amount_due,
    amount_paid,
    balance: Math.max(amount_due - amount_paid, 0),
    overpaid: Math.max(amount_paid - amount_due, 0),
  };
}

/** Parses an optional whole-number money field. `undefined`/"" → fallback; anything else invalid → NaN. */
export function parseMoney(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) && Number.isInteger(n) ? n : Number.NaN;
}

export type FeeInput = {
  price: number;
  discount: number;
  admission_fee: number;
  /** Omit when not recording a payment (e.g. editing a subscription). */
  amount_paid?: number;
};

/** Returns a user-facing error message, or null when the numbers make sense. */
export function validateFeeInput(input: FeeInput): string | null {
  const { price, discount, admission_fee, amount_paid } = input;
  if (!Number.isInteger(price) || price <= 0) return "Price must be a whole number greater than 0";
  if (!Number.isInteger(discount) || discount < 0) return "Discount must be a whole number, 0 or more";
  if (discount > price) return "Discount can't be more than the price";
  if (!Number.isInteger(admission_fee) || admission_fee < 0)
    return "Admission fee must be a whole number, 0 or more";
  if (amount_paid !== undefined) {
    if (!Number.isInteger(amount_paid) || amount_paid < 0)
      return "Amount paid must be a whole number, 0 or more";
    const due = amountDue({ price, discount, admission_fee });
    if (amount_paid > due) return `Amount paid can't be more than the amount due (${due})`;
  }
  return null;
}
