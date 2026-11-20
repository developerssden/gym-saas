// pages/api/registrations/getregistrations.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { Prisma, RegistrationStatus } from "@/prisma/generated/client";
import { REGISTRATION_STATUSES, normalizePhone } from "@/lib/registrations/schema";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const {
      page,
      limit,
      search,
      status,
    }: { page?: number; limit?: number; search?: string; status?: string } = req.body ?? {};

    const term = typeof search === "string" ? search.trim() : "";
    const or: Prisma.GymRegistrationWhereInput[] = [];
    if (term) {
      or.push({ owner_name: { contains: term, mode: "insensitive" } });
      or.push({ gym_name: { contains: term, mode: "insensitive" } });
      if (/^[+\d\s-]+$/.test(term)) {
        // Phones are stored as +92XXXXXXXXXX, so "0301 84" should still match.
        or.push({ phone: { contains: normalizePhone(term).slice(1) } });
      }
      or.push({ city: { contains: term, mode: "insensitive" } });
      or.push({ message: { contains: term, mode: "insensitive" } });
      const upper = term.toUpperCase();
      if ((REGISTRATION_STATUSES as readonly string[]).includes(upper)) {
        or.push({ status: upper as RegistrationStatus });
      }
    }

    const statusFilter =
      status && (REGISTRATION_STATUSES as readonly string[]).includes(status)
        ? (status as RegistrationStatus)
        : undefined;

    const whereClause: Prisma.GymRegistrationWhereInput = {
      is_deleted: false,
      status: statusFilter,
      OR: or.length ? or : undefined,
    };

    const currentPage = typeof page === "number" && page > 0 ? page : 1;
    const pageLimit = typeof limit === "number" && limit > 0 ? Math.min(limit, 100) : 10;

    const [registrations, totalCount] = await Promise.all([
      prisma.gymRegistration.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * pageLimit,
        take: pageLimit,
      }),
      prisma.gymRegistration.count({ where: whereClause }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: registrations,
      totalCount,
      pageCount: Math.ceil(totalCount / pageLimit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
