// pages/api/members/createmember.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { checkLimitExceeded, validateOwnerSubscription } from "@/lib/subscription-validation";
import { hashPassword } from "@/lib/authHelper";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const {
      user_id,
      gym_id,
      location_id,
      first_name,
      last_name,
      email,
      phone_number,
      address,
      city,
      state,
      zip_code,
      country,
      date_of_birth,
      cnic,
    } = req.body as Record<string, any>;

    if (!gym_id || !location_id || !first_name || !last_name) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: gym_id, location_id, first_name, last_name",
      });
    }

    // Validate gym belongs to owner
    const gym = await prisma.gym.findUnique({
      where: { id: gym_id },
      select: { id: true, owner_id: true, is_deleted: true },
    });

    if (!gym || gym.is_deleted || gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "UNAUTHORIZED_GYM",
        message: "Gym does not belong to you",
      });
    }

    // Validate location belongs to gym and owner
    const location = await prisma.location.findUnique({
      where: { id: location_id },
      select: { id: true, gym_id: true, is_deleted: true },
    });

    if (!location || location.is_deleted || location.gym_id !== gym_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid location_id or location does not belong to the selected gym",
      });
    }

    // Check subscription limits (per location)
    const limitCheck = await checkLimitExceeded(session.user.id, "member", location_id);
    if (limitCheck.exceeded) {
      return res.status(StatusCodes.CONFLICT).json({
        error: "LIMIT_EXCEEDED",
        resourceType: "member",
        current: limitCheck.current,
        max: limitCheck.max,
        locationId: location_id,
        message: `Member limit reached for this location (max ${limitCheck.max} per location)`,
      });
    }

    // Check if subscription is active
    const validation = await validateOwnerSubscription(session.user.id);
    if (!validation.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "SUBSCRIPTION_EXPIRED",
        message: "Subscription is expired or inactive",
      });
    }

    // Check if user already exists as member
    if (user_id) {
      const existingMember = await prisma.member.findUnique({
        where: { user_id },
      });
      if (existingMember) {
        return res.status(StatusCodes.CONFLICT).json({
          error: "User is already a member",
        });
      }
    }

    // Create or update user
    let finalUserId: string;
    if (user_id) {
      // Update existing user
      await prisma.user.update({
        where: { id: user_id },
        data: {
          first_name,
          last_name,
          email: email || null,
          phone_number: phone_number || undefined,
          address: address || undefined,
          city: city || undefined,
          state: state || undefined,
          zip_code: zip_code || undefined,
          country: country || undefined,
          date_of_birth: date_of_birth ? new Date(date_of_birth) : undefined,
          cnic: cnic || null,
          role: "MEMBER",
        },
      });
      finalUserId = user_id;
    } else {
      // Create new user
      if (!email) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Email is required when creating a new member",
        });
      }

      // Check if email already exists
      const existingUser = await prisma.user.findFirst({
        where: { email, is_deleted: false },
      });

      if (existingUser) {
        return res.status(StatusCodes.CONFLICT).json({
          error: "User with this email already exists",
        });
      }

      const newUser = await prisma.user.create({
        data: {
          first_name,
          last_name,
          email,
          phone_number: phone_number || "",
          address: address || "",
          city: city || "",
          state: state || "",
          zip_code: zip_code || "",
          country: country || "",
          date_of_birth: date_of_birth ? new Date(date_of_birth) : new Date(),
          cnic: cnic || null,
          role: "MEMBER",
          // Generate a random password (member can reset it later)
          password: await hashPassword(Math.random().toString(36).slice(-12)),
        },
      });
      finalUserId = newUser.id;
    }

    // Create member record
    const member = await prisma.member.create({
      data: {
        user_id: finalUserId,
        gym_id,
        location_id,
      },
      include: {
        user: true,
        gym: true,
        location: true,
      },
    });

    return res.status(StatusCodes.CREATED).json({
      message: "Member created successfully",
      data: member,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

