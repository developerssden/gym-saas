// pages/api/registrations/create.ts
// Public endpoint behind the landing-page "Register your gym" form.
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { gymRegistrationSchema, normalizePhone } from "@/lib/registrations/schema";
import { notifyNewRegistration } from "@/lib/registrations/notify";

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const RECEIVED = { message: "Registration received" };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  // Honeypot: people never see this field, so anything in it is a bot. Pretend it worked.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return res.status(StatusCodes.OK).json(RECEIVED);
  }

  const parsed = gymRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: "Please check the form and try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
  }

  try {
    const data = parsed.data;
    const phone = normalizePhone(data.phone);

    // A double-tap or a quick resubmit from the same number: keep the first one only.
    const recent = await prisma.gymRegistration.findFirst({
      where: {
        phone,
        is_deleted: false,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) {
      return res.status(StatusCodes.OK).json(RECEIVED);
    }

    const registration = await prisma.gymRegistration.create({
      data: {
        owner_name: data.owner_name,
        gym_name: data.gym_name,
        phone,
        city: data.city,
        member_count: data.member_count || null,
        message: data.message || null,
      },
    });

    try {
      await notifyNewRegistration(registration);
    } catch (err: unknown) {
      console.error("[registrations] notify failed", {
        message: err instanceof Error ? err.message : err,
      });
    }

    return res.status(StatusCodes.CREATED).json(RECEIVED);
  } catch (err: unknown) {
    console.error("[registrations] create failed", {
      message: err instanceof Error ? err.message : err,
    });
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Could not save your registration. Please try again." });
  }
}
