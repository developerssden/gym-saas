// Search and branch filters for the payments list (pure, safe for tests).
import type { Prisma } from "@/prisma/generated/client";

const userMatches = (q: string): Prisma.UserWhereInput => ({
  OR: [
    { first_name: { contains: q, mode: "insensitive" } },
    { last_name: { contains: q, mode: "insensitive" } },
    { email: { contains: q, mode: "insensitive" } },
    { phone_number: { contains: q, mode: "insensitive" } },
  ],
});

/**
 * Where fragment for a member payment search: transaction ID, member name,
 * email or phone, plus `phoneMemberIds` (members whose phone matched in any
 * format, see lib/members/phone-search.ts). Null when there's nothing to search.
 */
export function memberPaymentSearchWhere(
  search: unknown,
  phoneMemberIds: string[] = [],
): Prisma.PaymentWhereInput | null {
  const q = typeof search === "string" ? search.trim() : "";
  if (!q) return null;
  return {
    OR: [
      { transaction_id: { contains: q, mode: "insensitive" } },
      { memberSubscription: { member: { user: userMatches(q) } } },
      ...(phoneMemberIds.length ? [{ memberSubscription: { member_id: { in: phoneMemberIds } } }] : []),
    ],
  };
}

/** Where fragment for the super admin's owner payment search (transaction ID, owner name, email, phone). */
export function ownerPaymentSearchWhere(search: unknown): Prisma.PaymentWhereInput | null {
  const q = typeof search === "string" ? search.trim() : "";
  if (!q) return null;
  return {
    OR: [
      { transaction_id: { contains: q, mode: "insensitive" } },
      { ownerSubscription: { owner: userMatches(q) } },
    ],
  };
}

const toDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || !value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * Where fragment for the payments list filters: payment date from (included)
 * and to (excluded), as ISO strings, and the method (CASH / BANK_TRANSFER).
 * Anything missing or invalid is ignored. Null when there's nothing to filter.
 */
export function paymentFilterWhere(filters: {
  date_from?: unknown;
  date_to?: unknown;
  payment_method?: unknown;
}): Prisma.PaymentWhereInput | null {
  const from = toDate(filters.date_from);
  const to = toDate(filters.date_to);
  const method =
    filters.payment_method === "CASH" || filters.payment_method === "BANK_TRANSFER" ? filters.payment_method : undefined;
  const where: Prisma.PaymentWhereInput = {};
  if (from || to) where.payment_date = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
  if (method) where.payment_method = method;
  return Object.keys(where).length ? where : null;
}
