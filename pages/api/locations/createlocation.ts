// pages/api/locations/createLocation.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";

async function assertOwnerLocationLimit(owner_id: string) {
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
    const {
      gym_id,
      name,
      address,
      city,
      state,
      zip_code,
      country,
      phone_number,
    } = req.body as Record<string, any>;

    if (!gym_id || !name) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Missing required fields: gym_id, name" });
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gym_id },
      select: { id: true, owner_id: true, is_deleted: true },
    });
    if (!gym || gym.is_deleted) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid gym_id" });
    }

    await assertOwnerLocationLimit(gym.owner_id);

    const created = await prisma.location.create({
      data: {
        gym_id,
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        zip_code: zip_code || null,
        country: country || null,
        phone_number: phone_number || null,
      },
      include: { gym: { include: { owner: true } } },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Location created successfully",
      data: created,
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


