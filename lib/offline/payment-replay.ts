// Server side of offline sync: a payment request sent twice (retry after a
// dropped connection, or the outbox syncing again) must not be recorded twice.
import type { NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/client";

/**
 * If a payment with this client_id exists, answers the request with it and
 * returns true. A client_id used by someone else is refused.
 */
export async function answerIfReplayed(
  res: NextApiResponse,
  clientId: string | null,
  userId: string
): Promise<boolean> {
  if (!clientId) return false;
  const existing = await prisma.payment.findUnique({ where: { client_id: clientId } });
  if (!existing) return false;
  if (existing.recorded_by_id !== userId) {
    res.status(StatusCodes.CONFLICT).json({ error: "This payment id is already in use" });
    return true;
  }
  res.status(StatusCodes.OK).json({ message: "Payment already recorded", data: existing, duplicate: true });
  return true;
}

/** True when a create failed because the same client_id was saved meanwhile. */
export function isClientIdConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  // Driver adapters report the constraint in different places; look everywhere.
  return `${err.message} ${JSON.stringify(err.meta ?? {})}`.includes("client_id");
}
