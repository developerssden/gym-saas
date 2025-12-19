// pages/api/profile/updatepassword.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { hashPassword, verifyPassword } from "@/lib/authHelper";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { current_password, new_password } = req.body as {
      current_password: string;
      new_password: string;
    };

    if (!current_password || !new_password) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: current_password, new_password",
      });
    }

    if (new_password.length < 6) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "New password must be at least 6 characters long",
      });
    }

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user || !user.password) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "User not found or password not set",
      });
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(current_password, user.password);
    if (!isPasswordValid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(new_password);

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return res.status(StatusCodes.OK).json({
      message: "Password updated successfully",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}

