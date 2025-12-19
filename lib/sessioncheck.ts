/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { options } from "@/pages/api/auth/[...nextauth]";
import { StatusCodes } from "http-status-codes";
import type { Session } from "next-auth";

/**
 * Require either SUPER_ADMIN or GYM_OWNER role
 * Returns session if valid, null otherwise
 */
export async function requireAdminOrOwner(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<Session | null> {
  try {
    const session = await getServerSession(req, res, options);

    if (!session) {
      res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Unauthorized – No session found" });
      return null;
    }

    if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "GYM_OWNER") {
      res.status(StatusCodes.FORBIDDEN).json({
        message: "Forbidden – Only admin or gym owner can access this endpoint",
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

