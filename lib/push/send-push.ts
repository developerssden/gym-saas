import webpush from "web-push";
import prisma from "@/lib/prisma";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!configureVapid()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { user_id: userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key,
            },
          },
          JSON.stringify(payload)
        );
        return { status: "sent" as const };
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof (error as { statusCode?: unknown }).statusCode === "number"
            ? (error as { statusCode: number }).statusCode
            : undefined;

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({
            where: { id: subscription.id },
          });
          return { status: "removed" as const };
        }

        throw error;
      }
    })
  );

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value.status === "sent") sent += 1;
      if (result.value.status === "removed") removed += 1;
    } else {
      failed += 1;
      console.error("Push notification failed:", result.reason);
    }
  }

  return { sent, failed, removed };
}
