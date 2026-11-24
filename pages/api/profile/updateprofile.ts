// pages/api/profile/updateprofile.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/client";
import { StatusCodes } from "http-status-codes";
import { requireOwnAccount } from "@/lib/access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireOwnAccount(req, res);
  if (!session) return;

  try {
    const {
      first_name,
      last_name,
      phone_number,
      address,
      city,
      state,
      zip_code,
      country,
      date_of_birth,
      cnic,
    } = (req.body ?? {}) as Record<string, unknown>;

    // Build update data (exclude email - it cannot be changed).
    // Name and phone can't be blanked; everything else is optional and "" / null clears it.
    const updateData: Prisma.UserUpdateInput = {};
    const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const optional = (v: unknown) => text(v) || null;

    if (first_name !== undefined) {
      if (!text(first_name)) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Enter your first name" });
      updateData.first_name = text(first_name);
    }
    if (phone_number !== undefined) {
      if (!text(phone_number)) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Enter your phone number" });
      updateData.phone_number = text(phone_number);
    }
    if (last_name !== undefined) updateData.last_name = optional(last_name);
    if (address !== undefined) updateData.address = optional(address);
    if (city !== undefined) updateData.city = optional(city);
    if (state !== undefined) updateData.state = optional(state);
    if (zip_code !== undefined) updateData.zip_code = optional(zip_code);
    if (country !== undefined) updateData.country = optional(country);
    if (cnic !== undefined) updateData.cnic = optional(cnic);
    if (date_of_birth !== undefined) {
      if (!date_of_birth) updateData.date_of_birth = null;
      else {
        const dob = new Date(String(date_of_birth));
        if (Number.isNaN(dob.getTime()) || dob > new Date())
          return res.status(StatusCodes.BAD_REQUEST).json({ error: "That date of birth doesn't look right" });
        updateData.date_of_birth = dob;
      }
    }

    // Update user
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        address: true,
        city: true,
        state: true,
        zip_code: true,
        country: true,
        date_of_birth: true,
        cnic: true,
        profile_picture: true,
        role: true,
      },
    });

    return res.status(StatusCodes.OK).json({
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

