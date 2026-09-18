import { StatusCodes } from "http-status-codes";
import { Prisma } from "@/prisma/generated/client";

export function notificationsErrorResponse(
  prefix: string,
  err: unknown,
  fallbackMessage: string
) {
  const code =
    err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined;
  const isSchemaMismatch = code === "P2021" || code === "P2022";

  console.error(`${prefix} failed`, {
    code,
    meta: err instanceof Prisma.PrismaClientKnownRequestError ? err.meta : undefined,
    message: err instanceof Error ? err.message : err,
  });

  return {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    body: {
      error: isSchemaMismatch
        ? "Notifications are unavailable (database schema mismatch)."
        : fallbackMessage,
      ...(code ? { code } : {}),
    },
  };
}
