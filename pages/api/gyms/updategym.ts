// pages/api/gyms/updateGym.ts
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
    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Gym ID is required" });
    }

    const existing = await prisma.gym.findUnique({ where: { id } });
    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Gym not found" });
    }

    // For GYM_OWNER: verify they own this gym
    if (isGymOwner && existing.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "UNAUTHORIZED_GYM",
        message: "Gym does not belong to you",
      });
    }

    // Check subscription is active
    const validation = await validateOwnerSubscription(existing.owner_id);
    if (!validation.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "SUBSCRIPTION_EXPIRED",
        message: "Subscription is expired or inactive",
      });
    }

    // If owner_id is changing (only SUPER_ADMIN can do this), validate new owner and plan limit
    if (!isGymOwner && data.owner_id !== undefined && data.owner_id !== existing.owner_id) {
      const owner = await prisma.user.findUnique({
        where: { id: data.owner_id, is_deleted: false, role: "GYM_OWNER" },
        select: { id: true },
      });
      if (!owner) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid owner_id" });
      }
      
      // Check limit for new owner (excluding current gym)
      const currentCount = await prisma.gym.count({
        where: {
          owner_id: data.owner_id,
          is_deleted: false,
          NOT: { id },
        },
      });
      
      const newOwnerValidation = await validateOwnerSubscription(data.owner_id);
      if (newOwnerValidation.isActive && newOwnerValidation.subscription) {
        if (currentCount >= newOwnerValidation.subscription.plan.max_gyms) {
          return res.status(StatusCodes.CONFLICT).json({
            error: "LIMIT_EXCEEDED",
            resourceType: "gym",
            current: currentCount,
            max: newOwnerValidation.subscription.plan.max_gyms,
            message: `Gym limit reached for this owner (max ${newOwnerValidation.subscription.plan.max_gyms})`,
          });
        }
      }
    }

    // GYM_OWNER cannot change owner_id
    if (isGymOwner && data.owner_id !== undefined) {
      delete data.owner_id;
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


