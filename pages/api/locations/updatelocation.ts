// pages/api/locations/updateLocation.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";

async function assertOwnerLocationLimit(owner_id: string, excludingLocationId?: string) {
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

  const currentCount = await prisma.location.count({
    where: {
      is_deleted: false,
      gym: { owner_id },
      ...(excludingLocationId ? { NOT: { id: excludingLocationId } } : {}),
    },
  });

  if (currentCount >= activeSub.plan.max_locations) {
    throw new Error(`Location limit reached for this owner (max ${activeSub.plan.max_locations})`);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { id, ...data } = req.body as Record<string, any>;
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Location ID is required" });

    const existing = await prisma.location.findUnique({
      where: { id },
      include: { gym: true },
    });
    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Location not found" });
    }

    // If gym_id is changing, validate the new gym and plan limit for the new owner
    if (data.gym_id !== undefined && data.gym_id !== existing.gym_id) {
      const gym = await prisma.gym.findUnique({
        where: { id: data.gym_id },
        select: { id: true, owner_id: true, is_deleted: true },
      });
      if (!gym || gym.is_deleted) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid gym_id" });
      }
      await assertOwnerLocationLimit(gym.owner_id, id);
    }

    const updated = await prisma.location.update({
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
      include: { gym: { include: { owner: true } } },
    });

    return res.status(StatusCodes.OK).json({
      message: "Location updated successfully",
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


