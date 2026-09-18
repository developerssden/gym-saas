import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { Prisma, Role } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { role, search }: { role?: Role; search?: string } = req.body;
    if (role !== Role.GYM_OWNER && role !== Role.MEMBER) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "role must be GYM_OWNER or MEMBER",
      });
    }

    const hasSearch = typeof search === "string" && search.trim() !== "";
    const or: Prisma.UserWhereInput[] = [];
    if (hasSearch) {
      const q = search!.trim();
      or.push(
        { first_name: { contains: q, mode: "insensitive" } },
        { last_name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        is_deleted: false,
        is_active: true,
        role,
        OR: or.length ? or : undefined,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
      },
      orderBy: { first_name: "asc" },
      take: 50,
    });

    return res.status(StatusCodes.OK).json({ data: users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
