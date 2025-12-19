// pages/api/profile/updateprofile.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
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
    } = req.body as Record<string, any>;

    // Build update data (exclude email - it cannot be changed)
    const updateData: any = {};

    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (zip_code !== undefined) updateData.zip_code = zip_code;
    if (country !== undefined) updateData.country = country;
    if (date_of_birth !== undefined) updateData.date_of_birth = new Date(date_of_birth);
    if (cnic !== undefined) updateData.cnic = cnic || null;

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

