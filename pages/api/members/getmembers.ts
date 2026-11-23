// pages/api/members/getmembers.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAccess, gymScope, can } from "@/lib/access";
import { Prisma } from "@/prisma/generated/client";
import { memberListSelect } from "@/lib/api-selects";
import { memberIdsMatchingPhone, phoneSearchDigits } from "@/lib/members/phone-search";
import { membershipFilters, owingMembers, statusesForMembers } from "@/lib/members/membership-where";
import { parseMemberStatusFilter } from "@/lib/members/member-status";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  // Member lists also feed the member pickers on subscriptions and payments.
  const access = await requireAccess(req, res, {
    permission: ["members.view", "membersubscriptions.view", "membersubscriptions.create", "payments.record"],
    allowAdmin: true,
  });
  if (!access) return;

  try {
    const {
      page,
      limit,
      search,
      gym_id,
      location_id,
      with_status,
      has_membership,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      gym_id?: string;
      location_id?: string;
      /** Members page: add each member's membership status and balance, filter counts, and allow `status`. */
      with_status?: boolean;
      /** Memberships page: only members who have (or had) a membership. */
      has_membership?: boolean;
    } = req.body;
    const status = with_status ? parseMemberStatusFilter(req.body?.status) : null;

    const hasPagination = typeof page === "number" && typeof limit === "number";
    const hasSearch = typeof search === "string" && search.trim() !== "";

    const or: Prisma.MemberWhereInput[] = [];
    if (hasSearch) {
      or.push({
        user: {
          OR: [
            { first_name: { contains: search!, mode: "insensitive" } },
            { last_name: { contains: search!, mode: "insensitive" } },
            { email: { contains: search!, mode: "insensitive" } },
            { phone_number: { contains: search!, mode: "insensitive" } },
          ],
        },
      });
      // Phone numbers in any format: "0301 84" finds "+92301 84…".
      const digits = phoneSearchDigits(search);
      if (digits) {
        const ids = await memberIdsMatchingPhone(digits, access.ownerId);
        if (ids.length) or.push({ id: { in: ids } });
      }
    }

    const whereClause: Prisma.MemberWhereInput = {
      gym_id: gym_id ? gym_id : undefined,
      location_id: location_id ? location_id : undefined,
      // Owners and staff: only members from their gyms
      ...gymScope(access),
      OR: or.length ? or : undefined,
    };

    if (!hasPagination && !hasSearch) {
      const members = await prisma.member.findMany({
        where: whereClause,
        select: memberListSelect,
        orderBy: { joinedAt: "desc" },
      });

      return res.status(StatusCodes.OK).json({
        data: members,
        totalCount: members.length,
        pageCount: 1,
      });
    }

    const currentPage = page ?? 1;
    const pageLimit = limit ?? 10;
    const skip = (currentPage - 1) * pageLimit;

    if (with_status) {
      // Balances show to those who see payments; others just see that a member owes.
      const showAmounts = can(access, "payments.view") || can(access, "dashboard.revenue");
      const { memberStatusWhere } = membershipFilters();
      const base: Prisma.MemberWhereInput = has_membership
        ? { AND: [whereClause, { memberSubscriptions: { some: { is_deleted: false } } }] }
        : whereClause;
      const owing = await owingMembers(base);
      const owingIds = owing.map((o) => o.memberId);
      const filtered: Prisma.MemberWhereInput = !status
        ? base
        : { AND: [base, status === "owing" ? { id: { in: owingIds } } : memberStatusWhere(status)] };

      const [members, totalCount, all, active, expiring, expired, frozen] = await Promise.all([
        prisma.member.findMany({
          where: filtered,
          select: memberListSelect,
          orderBy: { joinedAt: "desc" },
          skip,
          take: pageLimit,
        }),
        prisma.member.count({ where: filtered }),
        prisma.member.count({ where: base }),
        prisma.member.count({ where: { AND: [base, memberStatusWhere("active")] } }),
        prisma.member.count({ where: { AND: [base, memberStatusWhere("expiring")] } }),
        prisma.member.count({ where: { AND: [base, memberStatusWhere("expired")] } }),
        prisma.member.count({ where: { AND: [base, memberStatusWhere("frozen")] } }),
      ]);
      const statuses = await statusesForMembers(members.map((m) => m.id));

      return res.status(StatusCodes.OK).json({
        data: members.map((m) => {
          const st = statuses.get(m.id)!;
          return {
            ...m,
            membership: {
              state: st.state,
              label: st.label,
              days: st.days,
              endDate: st.subscription ? new Date(st.subscription.end_date).toISOString() : null,
              subscriptionId: st.subscription?.id ?? null,
              price: st.subscription?.price ?? null,
              billingModel: st.subscription?.billing_model ?? null,
              startDate: st.subscription ? new Date(st.subscription.start_date).toISOString() : null,
              frozenSince: st.subscription?.frozen_since ? new Date(st.subscription.frozen_since).toISOString() : null,
              isExpiredFlag: st.subscription?.is_expired ?? false,
              owes: st.balance > 0,
              balance: showAmounts ? st.balance : null,
            },
          };
        }),
        totalCount,
        pageCount: Math.ceil(totalCount / pageLimit),
        counts: { all, active, expiring, expired, frozen, owing: owing.length },
      });
    }

    const [members, totalCount] = await Promise.all([
      prisma.member.findMany({
        where: whereClause,
        select: memberListSelect,
        orderBy: { joinedAt: "desc" },
        skip,
        take: pageLimit,
      }),
      prisma.member.count({ where: whereClause }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: members,
      totalCount,
      pageCount: Math.ceil(totalCount / pageLimit),
    });
  } catch (err: unknown) {
    console.error("Error in getmembers:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      error: message,
      stack: process.env.NODE_ENV === "development" ? stack : undefined
    });
  }
}

