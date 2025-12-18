// pages/api/gyms/createGym.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";

async function assertOwnerGymLimit(owner_id: string) {
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

  if (!activeSub?.plan) return; // No subscription => no limit enforcement here

  const currentCount = await prisma.gym.count({
    where: { owner_id, is_deleted: false },
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
    const {
      name,
      owner_id,
      address,
      city,
      state,
      zip_code,
      country,
      phone_number,
    } = req.body as Record<string, any>;

    if (!name || !owner_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: name, owner_id",
      });
    }

    const owner = await prisma.user.findUnique({
      where: { id: owner_id, is_deleted: false, role: "GYM_OWNER" },
      select: { id: true },
    });
    if (!owner) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid owner_id" });
    }

    await assertOwnerGymLimit(owner_id);

    const created = await prisma.gym.create({
      data: {
        name,
        owner_id,
        address: address || null,
        city: city || null,
        state: state || null,
        zip_code: zip_code || null,
        country: country || null,
        phone_number: phone_number || null,
      },
      include: { owner: true },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Gym created successfully",
      data: created,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Limit reached or other domain errors -> 409
    const status =
      typeof message === "string" && message.toLowerCase().includes("limit")
        ? StatusCodes.CONFLICT
        : StatusCodes.INTERNAL_SERVER_ERROR;
    return res.status(status).json({ error: message });
  }
}


