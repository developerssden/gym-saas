// pages/api/locations/updateLocation.ts
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
    const { id, ...data } = req.body as Record<string, any>;
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Location ID is required" });

    const existing = await prisma.location.findUnique({
      where: { id },
      include: { gym: true },
    });
    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Location not found" });
    }

    // For GYM_OWNER: verify they own the gym this location belongs to
    if (isGymOwner && existing.gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "UNAUTHORIZED_GYM",
        message: "Location does not belong to your gym",
      });
    }

    // Check subscription is active
    const validation = await validateOwnerSubscription(existing.gym.owner_id);
    if (!validation.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "SUBSCRIPTION_EXPIRED",
        message: "Subscription is expired or inactive",
      });
    }

    // If gym_id is changing (only SUPER_ADMIN can do this), validate the new gym and plan limit for the new owner
    if (!isGymOwner && data.gym_id !== undefined && data.gym_id !== existing.gym_id) {
      const gym = await prisma.gym.findUnique({
        where: { id: data.gym_id },
        select: { id: true, owner_id: true, is_deleted: true },
      });
      if (!gym || gym.is_deleted) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid gym_id" });
      }

      // Check limit for new owner (excluding current location)
      const currentCount = await prisma.location.count({
        where: {
          is_deleted: false,
          gym: { owner_id: gym.owner_id },
          NOT: { id },
        },
      });

      const newOwnerValidation = await validateOwnerSubscription(gym.owner_id);
      if (newOwnerValidation.isActive && newOwnerValidation.subscription) {
        if (currentCount >= newOwnerValidation.subscription.plan.max_locations) {
          return res.status(StatusCodes.CONFLICT).json({
            error: "LIMIT_EXCEEDED",
            resourceType: "location",
            current: currentCount,
            max: newOwnerValidation.subscription.plan.max_locations,
            message: `Location limit reached for this owner (max ${newOwnerValidation.subscription.plan.max_locations})`,
          });
        }
      }
    }

    // GYM_OWNER cannot change gym_id
    if (isGymOwner && data.gym_id !== undefined && data.gym_id !== existing.gym_id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – You cannot change the gym for a location",
      });
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


