// pages/api/members/updatemember.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";
import { checkLimitExceeded, validateOwnerSubscription } from "@/lib/subscription-validation";
import {
  normalizeOptionalString,
  resolveMemberGeoFields,
  type GeoFields,
} from "@/lib/members/location-geo-fallback";

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

    const nextFirstName =
      data.first_name !== undefined
        ? normalizeOptionalString(data.first_name)
        : normalizeOptionalString(existing.user.first_name);
    const nextAddress =
      data.address !== undefined
        ? normalizeOptionalString(data.address)
        : normalizeOptionalString(existing.user.address);
    const nextEmail =
      data.email !== undefined
        ? normalizeOptionalString(data.email)
        : normalizeOptionalString(existing.user.email);
    const nextPhone =
      data.phone_number !== undefined
        ? normalizeOptionalString(data.phone_number)
        : normalizeOptionalString(existing.user.phone_number);

    if (!nextFirstName) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "First name is required",
      });
    }

    if (!nextAddress) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Address is required",
      });
    }

    if (!nextEmail && !nextPhone) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Email or phone number is required",
      });
    }

    if (nextEmail && nextEmail !== existing.user.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: nextEmail,
          is_deleted: false,
          NOT: { id: existing.user_id },
        },
      });
      if (existingUser) {
        return res.status(StatusCodes.CONFLICT).json({
          error: "User with this email already exists",
        });
      }
    }

    const targetLocationId =
      data.location_id !== undefined ? data.location_id : existing.location_id;
    const targetGymId =
      data.gym_id !== undefined ? data.gym_id : existing.gym_id;

    if (nextPhone && nextPhone !== existing.user.phone_number) {
      const phoneTaken = await prisma.member.findFirst({
        where: {
          location_id: targetLocationId,
          id: { not: existing.id },
          user: {
            phone_number: nextPhone,
            is_deleted: false,
          },
        },
      });
      if (phoneTaken) {
        return res.status(StatusCodes.CONFLICT).json({
          error: `Phone number already registered at this location: ${nextPhone}`,
        });
      }
    }

    let locationGeo: GeoFields = existing.location;
    let gymGeo: GeoFields = existing.gym;

    if (
      targetLocationId !== existing.location_id ||
      targetGymId !== existing.gym_id
    ) {
      const locationWithGym = await prisma.location.findUnique({
        where: { id: targetLocationId },
        select: {
          city: true,
          state: true,
          zip_code: true,
          country: true,
          gym: {
            select: {
              city: true,
              state: true,
              zip_code: true,
              country: true,
            },
          },
        },
      });
      if (locationWithGym) {
        locationGeo = locationWithGym;
        gymGeo = locationWithGym.gym;
      }
    }

    const shouldApplyGeoFill =
      data.city !== undefined ||
      data.state !== undefined ||
      data.zip_code !== undefined ||
      data.country !== undefined;

    const geo = shouldApplyGeoFill
      ? resolveMemberGeoFields(
          {
            city: data.city !== undefined ? data.city : existing.user.city,
            state: data.state !== undefined ? data.state : existing.user.state,
            zip_code:
              data.zip_code !== undefined
                ? data.zip_code
                : existing.user.zip_code,
            country:
              data.country !== undefined
                ? data.country
                : existing.user.country,
          },
          locationGeo,
          gymGeo
        )
      : null;

    const userFieldsProvided =
      data.first_name !== undefined ||
      data.last_name !== undefined ||
      data.email !== undefined ||
      data.phone_number !== undefined ||
      data.address !== undefined ||
      data.city !== undefined ||
      data.state !== undefined ||
      data.zip_code !== undefined ||
      data.country !== undefined ||
      data.date_of_birth !== undefined ||
      data.cnic !== undefined;

    if (userFieldsProvided) {
      await prisma.user.update({
        where: { id: existing.user_id },
        data: {
          ...(data.first_name !== undefined && { first_name: nextFirstName }),
          ...(data.last_name !== undefined && {
            last_name: normalizeOptionalString(data.last_name),
          }),
          ...(data.email !== undefined && { email: nextEmail }),
          ...(data.phone_number !== undefined && {
            phone_number: nextPhone ?? "",
          }),
          ...(data.address !== undefined && { address: nextAddress }),
          ...(geo && {
            city: geo.city ?? "",
            state: geo.state ?? "",
            zip_code: geo.zip_code ?? "",
            country: geo.country ?? "",
          }),
          ...(data.date_of_birth !== undefined && {
            date_of_birth: data.date_of_birth
              ? new Date(data.date_of_birth)
              : null,
          }),
          ...(data.cnic !== undefined && {
            cnic: normalizeOptionalString(data.cnic),
          }),
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
