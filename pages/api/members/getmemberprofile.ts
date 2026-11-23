// pages/api/members/getmemberprofile.ts
// Everything about one member for their profile page: contact, membership
// status, every subscription with its freezes, and payment history.
import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownsGym, can } from "@/lib/access";
import { gymSummarySelect, locationSummarySelect, memberProfileUserSelect, recordedBySelect } from "@/lib/api-selects";
import { summarizeBalance } from "@/lib/member-balance";
import { memberStatus } from "@/lib/members/member-status";

export type MemberProfileResponse = {
  member: {
    id: string;
    joinedAt: string;
    user: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone_number: string | null;
      date_of_birth: string | null;
      address: string | null;
      city: string | null;
      cnic: string | null;
    };
    gym: { id: string; name: string; country: string | null };
    location: { id: string; name: string; country: string | null };
  };
  /** Whether amounts (prices, balances, payments) are included. */
  canSeeAmounts: boolean;
  status: {
    state: "active" | "expiring" | "expired" | "frozen" | "none";
    label: string;
    days: number | null;
    owes: boolean;
    balance: number | null;
  };
  /** Newest first. The first one decides the status unless a later-ending one is current. */
  subscriptions: Array<{
    id: string;
    billingModel: string;
    price: number;
    startDate: string;
    endDate: string;
    isExpired: boolean;
    frozenSince: string | null;
    churnReason: string | null;
    amountDue: number | null;
    paid: number | null;
    balance: number | null;
    freezes: Array<{ id: string; startDate: string; endDate: string | null; days: number | null; reason: string | null }>;
  }>;
  /** Newest first; null when the viewer may not see payments. */
  payments: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    transactionId: string | null;
    recordedBy: { first_name: string | null; last_name: string | null; role: string } | null;
  }> | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MemberProfileResponse | { error: string }>,
) {
  if (req.method !== "POST") return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ error: "Method not allowed" });

  const access = await requireAccess(req, res, { permission: "members.view" });
  if (!access) return;

  try {
    const { id } = req.body as { id?: string };
    if (!id || typeof id !== "string") return res.status(StatusCodes.BAD_REQUEST).json({ error: "Member ID is required" });

    const member = await prisma.member.findUnique({
      where: { id },
      select: {
        id: true,
        joinedAt: true,
        user: { select: memberProfileUserSelect },
        gym: { select: { ...gymSummarySelect, owner_id: true, is_deleted: true } },
        location: { select: locationSummarySelect },
        memberSubscriptions: {
          where: { is_deleted: false },
          orderBy: { end_date: "desc" },
          select: {
            id: true,
            billing_model: true,
            price: true,
            discount: true,
            admission_fee: true,
            start_date: true,
            end_date: true,
            is_expired: true,
            frozen_since: true,
            churn_reason: true,
            freezes: {
              orderBy: { start_date: "desc" },
              select: { id: true, start_date: true, end_date: true, days: true, reason: true },
            },
            payments: {
              orderBy: { payment_date: "desc" },
              select: {
                id: true,
                amount: true,
                payment_method: true,
                payment_date: true,
                transaction_id: true,
                recordedBy: { select: recordedBySelect },
              },
            },
          },
        },
      },
    });

    // Same answer for "missing" and "not yours", so ids can't be probed.
    if (!member || member.gym.is_deleted || !ownsGym(access, member.gym)) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Member not found" });
    }

    const canSeeAmounts = can(access, "payments.view") || can(access, "dashboard.revenue");
    const subs = member.memberSubscriptions.map((s) => {
      const paid = s.payments.reduce((sum, p) => sum + p.amount, 0);
      return { ...s, paid, summary: summarizeBalance(s, [{ amount: paid }]) };
    });
    const status = memberStatus(subs);
    const { owner_id: _owner, is_deleted: _deleted, ...gym } = member.gym;
    void _owner;
    void _deleted;

    return res.status(StatusCodes.OK).json({
      member: {
        id: member.id,
        joinedAt: member.joinedAt.toISOString(),
        user: {
          first_name: member.user.first_name,
          last_name: member.user.last_name,
          email: member.user.email,
          phone_number: member.user.phone_number,
          date_of_birth: iso(member.user.date_of_birth),
          address: member.user.address,
          city: member.user.city,
          cnic: member.user.cnic,
        },
        gym,
        location: member.location,
      },
      canSeeAmounts,
      status: {
        state: status.state,
        label: status.label,
        days: status.days,
        owes: status.balance > 0,
        balance: canSeeAmounts ? status.balance : null,
      },
      subscriptions: subs.map((s) => ({
        id: s.id,
        billingModel: s.billing_model,
        // Needed to pre-fill Renew; only displayed when canSeeAmounts.
        price: s.price,
        startDate: s.start_date.toISOString(),
        endDate: s.end_date.toISOString(),
        isExpired: s.is_expired,
        frozenSince: iso(s.frozen_since),
        churnReason: s.churn_reason,
        amountDue: canSeeAmounts ? s.summary.amount_due : null,
        paid: canSeeAmounts ? s.summary.amount_paid : null,
        balance: canSeeAmounts ? s.summary.balance : null,
        freezes: s.freezes.map((f) => ({
          id: f.id,
          startDate: f.start_date.toISOString(),
          endDate: iso(f.end_date),
          days: f.days,
          reason: f.reason,
        })),
      })),
      payments: canSeeAmounts
        ? subs
            .flatMap((s) => s.payments)
            .sort((a, b) => b.payment_date.getTime() - a.payment_date.getTime())
            .map((p) => ({
              id: p.id,
              amount: p.amount,
              paymentMethod: p.payment_method,
              paymentDate: p.payment_date.toISOString(),
              transactionId: p.transaction_id,
              recordedBy: p.recordedBy,
            }))
        : null,
    });
  } catch (err: unknown) {
    console.error("Error in getmemberprofile:", err);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Couldn't load this member" });
  }
}
