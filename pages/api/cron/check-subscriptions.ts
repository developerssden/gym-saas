import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import prisma from "@/lib/prisma";
import sendEmail from "@/lib/sendEmail";
import {
  computeMemberActions,
  computeOwnerActions,
  type CronAction,
} from "@/lib/cron/computeActions";
import {
  executeExpirationDelivery,
  executeReminderDelivery,
} from "@/lib/cron/delivery";
import {
  getGymOwnerSummaryEmail,
  getMemberReminderEmail,
  getOwnerReminderEmail,
  getSuperAdminSummaryEmail,
} from "@/lib/email/subscription-emails";
import { sendPushToUser } from "@/lib/push/send-push";

type DeliveryMetrics = {
  expiredMarked: number;
  remindersSent: number;
  remindersFailed: number;
  expirationNotificationsSent: number;
  expirationNotificationsFailed: number;
  skippedNoRecipient: number;
  summariesSent: number;
  summariesFailed: number;
  invalidSubscriptions: number;
  pushSent: number;
  pushFailed: number;
  pushRemoved: number;
};

const createMetrics = (): DeliveryMetrics => ({
  expiredMarked: 0,
  remindersSent: 0,
  remindersFailed: 0,
  expirationNotificationsSent: 0,
  expirationNotificationsFailed: 0,
  skippedNoRecipient: 0,
  summariesSent: 0,
  summariesFailed: 0,
  invalidSubscriptions: 0,
  pushSent: 0,
  pushFailed: 0,
  pushRemoved: 0,
});

function getCronSecret(req: NextApiRequest): string | undefined {
  const headerSecret = req.headers["x-cron-secret"];
  if (typeof headerSecret === "string") return headerSecret;

  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }

  return undefined;
}

function reminderFlag(action: CronAction) {
  if (action.type === "FIRST_REMINDER") {
    return { first_reminder_sent: true };
  }
  if (action.type === "SECOND_REMINDER") {
    return { second_reminder_sent: true };
  }
  return null;
}

async function recordPushMetrics(
  metrics: DeliveryMetrics,
  userId: string | undefined,
  payload: { title: string; body: string; url?: string }
) {
  if (!userId) return;
  try {
    const result = await sendPushToUser(userId, payload);
    metrics.pushSent += result.sent;
    metrics.pushFailed += result.failed;
    metrics.pushRemoved += result.removed;
  } catch (error) {
    metrics.pushFailed += 1;
    console.error(`Failed push notification for user ${userId}:`, error);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" });
  }

  const cronSecret = getCronSecret(req);
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Unauthorized" });
  }

  const referenceDate = new Date();
  const ownerMetrics = createMetrics();
  const memberMetrics = createMetrics();

  try {
    const ownerSubscriptions = await prisma.ownerSubscription.findMany({
      where: {
        is_active: true,
        is_deleted: false,
        OR: [{ is_expired: false }, { notification_sent: false }],
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        plan: { select: { name: true } },
      },
    });

    const newlyExpiredOwners: Array<{
      name: string;
      email: string;
      planName: string;
    }> = [];

    for (const subscription of ownerSubscriptions) {
      let action: CronAction;
      try {
        action = computeOwnerActions([subscription], referenceDate)[0];
      } catch (error) {
        ownerMetrics.invalidSubscriptions++;
        console.error(
          `Invalid owner subscription date for ${subscription.id}:`,
          error
        );
        continue;
      }

      if (action.type === "NONE") continue;

      if (action.type === "EXPIRE") {
        const result = await executeExpirationDelivery({
          alreadyExpired: subscription.is_expired,
          hasRecipient: Boolean(
            action.ownerEmail && action.ownerName && action.planName
          ),
          markExpired: async () => {
            await prisma.ownerSubscription.update({
              where: { id: action.id },
              data: { is_expired: true },
            });
          },
          send: async () => {
            const { subject, text, html } = getOwnerReminderEmail(
              action.ownerName!,
              0,
              action.planName!
            );
            await sendEmail(action.ownerEmail!, subject, text, html);
          },
          markDelivered: async () => {
            await prisma.ownerSubscription.update({
              where: { id: action.id },
              data: { notification_sent: true },
            });
          },
        });

        if (result.stateChanged) {
          ownerMetrics.expiredMarked++;
          newlyExpiredOwners.push({
            name: action.ownerName || "Owner",
            email: action.ownerEmail || "No email",
            planName: action.planName || "Unknown plan",
          });
        }
        if (result.sent) ownerMetrics.expirationNotificationsSent++;
        if (result.skipped) ownerMetrics.skippedNoRecipient++;
        if (result.failed) {
          ownerMetrics.expirationNotificationsFailed++;
          console.error(
            `Failed owner expiration notification for ${action.id}:`,
            result.error
          );
        }

        if (result.sent || result.stateChanged) {
          await recordPushMetrics(ownerMetrics, subscription.owner.id, {
            title: "Gym subscription expired",
            body: `Your ${action.planName || "gym"} subscription has expired.`,
            url: "/dashboard",
          });
        }
        continue;
      }

      const flag = reminderFlag(action);
      const result = await executeReminderDelivery({
        hasRecipient: Boolean(action.email && action.planName),
        send: async () => {
          const { subject, text, html } = getOwnerReminderEmail(
            action.name,
            action.daysLeft,
            action.planName!
          );
          await sendEmail(action.email, subject, text, html);
        },
        markDelivered: async () => {
          await prisma.ownerSubscription.update({
            where: { id: action.id },
            data: flag!,
          });
        },
      });
      if (result.sent) ownerMetrics.remindersSent++;
      if (result.skipped) ownerMetrics.skippedNoRecipient++;
      if (result.failed) {
        ownerMetrics.remindersFailed++;
        console.error(`Failed owner reminder for ${action.id}:`, result.error);
      }

      if (result.sent) {
        await recordPushMetrics(ownerMetrics, subscription.owner.id, {
          title: `Subscription expires in ${action.daysLeft} day${action.daysLeft === 1 ? "" : "s"}`,
          body: `Your ${action.planName || "gym"} subscription expires soon.`,
          url: "/dashboard",
        });
      }
    }

    if (newlyExpiredOwners.length > 0) {
      const superAdmins = await prisma.user.findMany({
        where: {
          role: "SUPER_ADMIN",
          is_active: true,
          is_deleted: false,
          email: { not: null },
        },
        select: { email: true },
      });
      const { subject, text, html } =
        getSuperAdminSummaryEmail(newlyExpiredOwners);

      for (const admin of superAdmins) {
        if (!admin.email) continue;
        try {
          await sendEmail(admin.email, subject, text, html);
          ownerMetrics.summariesSent++;
        } catch (error) {
          ownerMetrics.summariesFailed++;
          console.error(
            `Failed expiration summary for admin ${admin.email}:`,
            error
          );
        }
      }
    }

    const memberSubscriptions = await prisma.memberSubscription.findMany({
      where: {
        is_active: true,
        is_deleted: false,
        OR: [{ is_expired: false }, { notification_sent: false }],
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                phone_number: true,
                address: true,
              },
            },
            gym: {
              include: {
                owner: {
                  select: {
                    id: true,
                    email: true,
                    first_name: true,
                    last_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const newlyExpiredMembersByOwner = new Map<
      string,
      Array<{
        name: string;
        email: string;
        phone_number: string | null;
        address: string | null;
        start_date: Date;
        end_date: Date;
        ownerEmail: string;
      }>
    >();

    for (const subscription of memberSubscriptions) {
      let action: CronAction;
      try {
        action = computeMemberActions([subscription], referenceDate)[0];
      } catch (error) {
        memberMetrics.invalidSubscriptions++;
        console.error(
          `Invalid member subscription date for ${subscription.id}:`,
          error
        );
        continue;
      }

      if (action.type === "NONE") continue;

      if (action.type === "EXPIRE") {
        const result = await executeExpirationDelivery({
          alreadyExpired: subscription.is_expired,
          hasRecipient: Boolean(action.ownerEmail && action.ownerName),
          markExpired: async () => {
            await prisma.memberSubscription.update({
              where: { id: action.id },
              data: { is_expired: true },
            });
          },
          send: async () => {
            const { subject, text, html } = getMemberReminderEmail(
              action.ownerName!,
              0
            );
            await sendEmail(action.ownerEmail!, subject, text, html);
          },
          markDelivered: async () => {
            await prisma.memberSubscription.update({
              where: { id: action.id },
              data: { notification_sent: true },
            });
          },
        });

        if (result.stateChanged) {
          memberMetrics.expiredMarked++;
          const ownerId = subscription.member.gym.owner.id;
          const expiredMembers =
            newlyExpiredMembersByOwner.get(ownerId) || [];
          expiredMembers.push({
            name: action.ownerName || "Member",
            email: action.ownerEmail || "No email",
            phone_number: subscription.member.user.phone_number,
            address: subscription.member.user.address,
            start_date: subscription.start_date,
            end_date: subscription.end_date,
            ownerEmail: subscription.member.gym.owner.email || "",
          });
          newlyExpiredMembersByOwner.set(ownerId, expiredMembers);
        }
        if (result.sent) memberMetrics.expirationNotificationsSent++;
        if (result.skipped) memberMetrics.skippedNoRecipient++;
        if (result.failed) {
          memberMetrics.expirationNotificationsFailed++;
          console.error(
            `Failed member expiration notification for ${action.id}:`,
            result.error
          );
        }

        if (result.sent || result.stateChanged) {
          await recordPushMetrics(
            memberMetrics,
            subscription.member.user.id,
            {
              title: "Gym membership expired",
              body: "Your gym membership has expired. Please renew to continue access.",
              url: "/dashboard",
            }
          );
        }
        continue;
      }

      const flag = reminderFlag(action);
      const result = await executeReminderDelivery({
        hasRecipient: Boolean(action.email),
        send: async () => {
          const { subject, text, html } = getMemberReminderEmail(
            action.name,
            action.daysLeft
          );
          await sendEmail(action.email, subject, text, html);
        },
        markDelivered: async () => {
          await prisma.memberSubscription.update({
            where: { id: action.id },
            data: flag!,
          });
        },
      });
      if (result.sent) memberMetrics.remindersSent++;
      if (result.skipped) memberMetrics.skippedNoRecipient++;
      if (result.failed) {
        memberMetrics.remindersFailed++;
        console.error(`Failed member reminder for ${action.id}:`, result.error);
      }

      if (result.sent) {
        await recordPushMetrics(memberMetrics, subscription.member.user.id, {
          title: `Membership expires in ${action.daysLeft} day${action.daysLeft === 1 ? "" : "s"}`,
          body: "Your gym membership expires soon. Please renew to avoid interruption.",
          url: "/dashboard",
        });
      }
    }

    for (const expiredMembers of newlyExpiredMembersByOwner.values()) {
      const ownerEmail = expiredMembers[0]?.ownerEmail;
      if (!ownerEmail) {
        memberMetrics.skippedNoRecipient++;
        continue;
      }

      const { subject, text, html } =
        getGymOwnerSummaryEmail(expiredMembers);
      try {
        await sendEmail(ownerEmail, subject, text, html);
        memberMetrics.summariesSent++;
      } catch (error) {
        memberMetrics.summariesFailed++;
        console.error(
          `Failed member expiration summary for owner ${ownerEmail}:`,
          error
        );
      }
    }

    return res.status(StatusCodes.OK).json({
      message: "Subscription check completed",
      summary: {
        ownerSubscriptions: ownerMetrics,
        memberSubscriptions: memberMetrics,
      },
      deliveryGuarantee: "at-least-once",
    });
  } catch (error) {
    console.error("Error in subscription check cron job:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}
