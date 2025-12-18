// pages/api/announcements/getAnnouncements.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { AnnouncementAudience, Prisma } from "@/prisma/generated/client";

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
      audience,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      audience?: AnnouncementAudience | "ALL" | "GYM_OWNER" | "MEMBER";
    } = req.body;

    const hasPagination = typeof page === "number" && typeof limit === "number";
    const hasSearch = typeof search === "string" && search.trim() !== "";

    const or: Prisma.AnnouncementWhereInput[] = [];
    if (hasSearch) {
      or.push({ title: { contains: search!, mode: "insensitive" } });
      or.push({ message: { contains: search!, mode: "insensitive" } });
      or.push({ audience: { equals: search!.toUpperCase() as any } });
    }

    const whereClause: Prisma.AnnouncementWhereInput = {
      is_deleted: false,
      audience: audience ? (audience as AnnouncementAudience) : undefined,
      OR: or.length ? or : undefined,
    };

    if (!hasPagination && !hasSearch) {
      const announcements = await prisma.announcement.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });

      return res.status(StatusCodes.OK).json({
        data: announcements,
        totalCount: announcements.length,
        pageCount: 1,
      });
    }

    const currentPage = page ?? 1;
    const pageLimit = limit ?? 10;
    const skip = (currentPage - 1) * pageLimit;

    const [announcements, totalCount] = await Promise.all([
      prisma.announcement.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageLimit,
      }),
      prisma.announcement.count({ where: whereClause }),
    ]);

    return res.status(StatusCodes.OK).json({
      data: announcements,
      totalCount,
      pageCount: Math.ceil(totalCount / pageLimit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}


