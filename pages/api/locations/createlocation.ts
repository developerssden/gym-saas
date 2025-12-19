// pages/api/locations/createLocation.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";
import { checkLimitExceeded, validateOwnerSubscription } from "@/lib/subscription-validation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const isGymOwner = session.user.role === "GYM_OWNER";

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

    // For GYM_OWNER: verify they own this gym
    if (isGymOwner && gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "UNAUTHORIZED_GYM",
        message: "Gym does not belong to you",
      });
    }

    // Check subscription limits
    const limitCheck = await checkLimitExceeded(gym.owner_id, "location");
    if (limitCheck.exceeded) {
      return res.status(StatusCodes.CONFLICT).json({
        error: "LIMIT_EXCEEDED",
        resourceType: "location",
        current: limitCheck.current,
        max: limitCheck.max,
        message: `Location limit reached for this owner (max ${limitCheck.max})`,
      });
    }

    // Check if subscription is active
    const validation = await validateOwnerSubscription(gym.owner_id);
    if (!validation.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "SUBSCRIPTION_EXPIRED",
        message: "Subscription is expired or inactive",
      });
    }

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


