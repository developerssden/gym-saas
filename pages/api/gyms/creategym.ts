// pages/api/gyms/createGym.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";
import { checkLimitExceeded } from "@/lib/subscription-validation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const isGymOwner = session.user.role === "GYM_OWNER";

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

    if (!name) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: name",
      });
    }

    // Determine owner_id based on role
    let finalOwnerId: string;
    if (isGymOwner) {
      // GYM_OWNER: use their own ID, ignore body owner_id
      finalOwnerId = session.user.id;
    } else {
      // SUPER_ADMIN: require owner_id in body
      if (!owner_id) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Missing required field: owner_id",
        });
      }
      finalOwnerId = owner_id;
    }

    const owner = await prisma.user.findUnique({
      where: { id: finalOwnerId, is_deleted: false, role: "GYM_OWNER" },
      select: { id: true },
    });
    if (!owner) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid owner_id" });
    }

    // Check subscription limits
    const limitCheck = await checkLimitExceeded(finalOwnerId, "gym");
    if (limitCheck.exceeded) {
      return res.status(StatusCodes.CONFLICT).json({
        error: "LIMIT_EXCEEDED",
        resourceType: "gym",
        current: limitCheck.current,
        max: limitCheck.max,
        message: `Gym limit reached for this owner (max ${limitCheck.max})`,
      });
    }

    // Check if subscription is active
    const validation = await import("@/lib/subscription-validation").then((m) =>
      m.validateOwnerSubscription(finalOwnerId)
    );
    if (!validation.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "SUBSCRIPTION_EXPIRED",
        message: "Subscription is expired or inactive",
      });
    }

    const created = await prisma.gym.create({
      data: {
        name,
        owner_id: finalOwnerId,
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


