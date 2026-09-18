import prisma from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/client";

export type InAppNotificationInput = {
  title: string;
  body: string;
  url?: string;
  type: string;
};

function logInAppNotificationError(context: string, err: unknown) {
  const code =
    err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined;

  console.error(`[in-app-notification] ${context}`, {
    code,
    meta: err instanceof Prisma.PrismaClientKnownRequestError ? err.meta : undefined,
    message: err instanceof Error ? err.message : err,
  });
}

export async function createInAppNotification(
  userId: string,
  data: InAppNotificationInput
): Promise<void> {
  try {
    await prisma.inAppNotification.create({
      data: {
        user_id: userId,
        title: data.title,
        body: data.body,
        url: data.url,
        type: data.type,
      },
    });
  } catch (err: unknown) {
    logInAppNotificationError("failed to create notification", err);
  }
}
