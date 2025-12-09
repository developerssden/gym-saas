/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/checkAdminSession.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { options } from "@/pages/api/auth/[...nextauth]";
import { StatusCodes } from "http-status-codes";

export async function requireSuperAdmin(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getServerSession(req, res, options);

    if (!session) {
      res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Unauthorized – No session found" });
      return null;
    }

    if (session?.user?.role !== "SUPER_ADMIN") {
      res.status(StatusCodes.FORBIDDEN).json({
        message: "Forbidden – Only admin can access this endpoint",
      });
      return null;
    }

    return session;
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Session validation failed",
      error: (error as any).message,
    });
    return null;
  }
}
