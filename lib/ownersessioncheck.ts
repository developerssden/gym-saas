/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/ownersessioncheck.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { options } from "@/pages/api/auth/[...nextauth]";
import { StatusCodes } from "http-status-codes";
import type { Session } from "next-auth";

export async function requireGymOwner(
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

    if (session?.user?.role !== "GYM_OWNER") {
      res.status(StatusCodes.FORBIDDEN).json({
        message: "Forbidden – Only gym owner can access this endpoint",
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

/**
 * Extract gym owner ID from session
 */
export function getGymOwnerId(session: Session | null): string | null {
  if (!session?.user?.id) {
    return null;
  }
  return session.user.id;
}
