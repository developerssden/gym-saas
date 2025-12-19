// pages/api/members/updatemember.ts
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
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Member ID is required" });
    }

    const existing = await prisma.member.findUnique({
      where: { id },
      include: {
        gym: true,
        location: true,
        user: true,
      },
    });

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Member not found" });
    }

    // For GYM_OWNER: verify they own the gym this member belongs to
    if (isGymOwner && existing.gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "UNAUTHORIZED_GYM",
        message: "Member does not belong to your gym",
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

    // If location_id is changing, validate new location and check limits
    if (data.location_id !== undefined && data.location_id !== existing.location_id) {
      const newLocation = await prisma.location.findUnique({
        where: { id: data.location_id },
        include: { gym: true },
      });

      if (!newLocation || newLocation.is_deleted) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid location_id" });
      }

      // Verify new location belongs to same gym (or owner's gym for GYM_OWNER)
      if (isGymOwner && newLocation.gym.owner_id !== session.user.id) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: "Location does not belong to your gym",
        });
      }

      // Check limit for new location
      const limitCheck = await checkLimitExceeded(
        existing.gym.owner_id,
        "member",
        data.location_id
      );
      if (limitCheck.exceeded) {
        return res.status(StatusCodes.CONFLICT).json({
          error: "LIMIT_EXCEEDED",
          resourceType: "member",
          current: limitCheck.current,
          max: limitCheck.max,
          locationId: data.location_id,
          message: `Member limit reached for this location (max ${limitCheck.max} per location)`,
        });
      }
    }

    // If gym_id is changing (only SUPER_ADMIN can do this)
    if (!isGymOwner && data.gym_id !== undefined && data.gym_id !== existing.gym_id) {
      const newGym = await prisma.gym.findUnique({
        where: { id: data.gym_id },
        select: { id: true, owner_id: true, is_deleted: true },
      });

      if (!newGym || newGym.is_deleted) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid gym_id" });
      }

      // If location_id not provided, use first location of new gym
      if (!data.location_id) {
        const firstLocation = await prisma.location.findFirst({
          where: {
            gym_id: data.gym_id,
            is_deleted: false,
          },
        });
        if (firstLocation) {
          data.location_id = firstLocation.id;
        } else {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "New gym has no locations. Please create a location first.",
          });
        }
      }

      // Check limit for new location
      const limitCheck = await checkLimitExceeded(
        newGym.owner_id,
        "member",
        data.location_id
      );
      if (limitCheck.exceeded) {
        return res.status(StatusCodes.CONFLICT).json({
          error: "LIMIT_EXCEEDED",
          resourceType: "member",
          current: limitCheck.current,
          max: limitCheck.max,
          locationId: data.location_id,
          message: `Member limit reached for this location (max ${limitCheck.max} per location)`,
        });
      }
    }

    // GYM_OWNER cannot change gym_id
    if (isGymOwner && data.gym_id !== undefined && data.gym_id !== existing.gym_id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Forbidden – You cannot change the gym for a member",
      });
    }

    // Update user fields if provided
    if (data.first_name || data.last_name || data.email || data.phone_number) {
      await prisma.user.update({
        where: { id: existing.user_id },
        data: {
          ...(data.first_name !== undefined && { first_name: data.first_name }),
          ...(data.last_name !== undefined && { last_name: data.last_name }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.phone_number !== undefined && { phone_number: data.phone_number }),
          ...(data.address !== undefined && { address: data.address }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.state !== undefined && { state: data.state }),
          ...(data.zip_code !== undefined && { zip_code: data.zip_code }),
          ...(data.country !== undefined && { country: data.country }),
          ...(data.date_of_birth !== undefined && {
            date_of_birth: new Date(data.date_of_birth),
          }),
          ...(data.cnic !== undefined && { cnic: data.cnic }),
        },
      });
    }

    // Update member record
    const updated = await prisma.member.update({
      where: { id },
      data: {
        ...(data.gym_id !== undefined && { gym_id: data.gym_id }),
        ...(data.location_id !== undefined && { location_id: data.location_id }),
      },
      include: {
        user: true,
        gym: true,
        location: true,
      },
    });

    return res.status(StatusCodes.OK).json({
      message: "Member updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

