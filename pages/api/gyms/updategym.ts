// pages/api/gyms/updateGym.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";

async function assertOwnerGymLimit(owner_id: string, excludingGymId?: string) {
  const activeSub = await prisma.ownerSubscription.findFirst({
    where: {
      owner_id,
      is_deleted: false,
      is_active: true,
      is_expired: false,
    },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  if (!activeSub?.plan) return;

  const currentCount = await prisma.gym.count({
    where: {
      owner_id,
      is_deleted: false,
      ...(excludingGymId ? { NOT: { id: excludingGymId } } : {}),
    },
  });

  if (currentCount >= activeSub.plan.max_gyms) {
    throw new Error(`Gym limit reached for this owner (max ${activeSub.plan.max_gyms})`);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { id, ...data } = req.body as Record<string, any>;
    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Gym ID is required" });
    }

    const existing = await prisma.gym.findUnique({ where: { id } });
    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Gym not found" });
    }

    // If owner_id is changing, validate new owner and plan limit
    if (data.owner_id !== undefined && data.owner_id !== existing.owner_id) {
      const owner = await prisma.user.findUnique({
        where: { id: data.owner_id, is_deleted: false, role: "GYM_OWNER" },
        select: { id: true },
      });
      if (!owner) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid owner_id" });
      }
      await assertOwnerGymLimit(data.owner_id, id);
    }

    const updated = await prisma.gym.update({
      where: { id },
      data: {
        ...data,
        address: data.address === undefined ? undefined : data.address || null,
        city: data.city === undefined ? undefined : data.city || null,
        state: data.state === undefined ? undefined : data.state || null,
        zip_code: data.zip_code === undefined ? undefined : data.zip_code || null,
        country: data.country === undefined ? undefined : data.country || null,
        phone_number: data.phone_number === undefined ? undefined : data.phone_number || null,
      },
      include: { owner: true },
    });

    return res.status(StatusCodes.OK).json({
      message: "Gym updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      typeof message === "string" && message.toLowerCase().includes("limit")
        ? StatusCodes.CONFLICT
        : StatusCodes.INTERNAL_SERVER_ERROR;
    return res.status(status).json({ error: message });
  }
}


