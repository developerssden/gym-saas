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
