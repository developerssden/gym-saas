// pages/api/cron/check-subscriptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import sendEmail from "@/lib/sendEmail";
import {
  computeOwnerActions,
  computeMemberActions,
} from "@/lib/cron/computeActions";

function getCronSecret(req: NextApiRequest): string | undefined {
  const headerSecret = req.headers["x-cron-secret"];
  if (typeof headerSecret === "string") return headerSecret;

  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }

  return undefined;
}

// Email templates
const getOwnerReminderEmail = (ownerName: string, daysLeft: number, planName: string) => {
  const subject = daysLeft === 0 
    ? "Your Gym Subscription Has Expired"
    : `Your Gym Subscription Expires in ${daysLeft} Day${daysLeft > 1 ? "s" : ""}`;
  
  const text = daysLeft === 0
    ? `Dear ${ownerName},\n\nYour subscription to ${planName} has expired. Please renew your subscription to continue using our services.\n\nThank you.`
    : `Dear ${ownerName},\n\nThis is a reminder that your subscription to ${planName} will expire in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.\n\nPlease renew your subscription to avoid any interruption in service.\n\nThank you.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p>Dear ${ownerName},</p>
      ${daysLeft === 0 
        ? `<p>Your subscription to <strong>${planName}</strong> has expired. Please renew your subscription to continue using our services.</p>`
        : `<p>This is a reminder that your subscription to <strong>${planName}</strong> will expire in <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong>.</p>
           <p>Please renew your subscription to avoid any interruption in service.</p>`
      }
      <p>Thank you.</p>
    </div>
  `;
  
  return { subject, text, html };
};

const getMemberReminderEmail = (memberName: string, daysLeft: number) => {
  const subject = daysLeft === 0
    ? "Your Gym Membership Has Expired"
    : `Your Gym Membership Expires in ${daysLeft} Day${daysLeft > 1 ? "s" : ""}`;
  
  const text = daysLeft === 0
    ? `Dear ${memberName},\n\nYour gym membership has expired. Please renew your membership to continue accessing the gym.\n\nThank you.`
    : `Dear ${memberName},\n\nThis is a reminder that your gym membership will expire in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.\n\nPlease renew your membership to avoid any interruption in service.\n\nThank you.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p>Dear ${memberName},</p>
      ${daysLeft === 0
        ? `<p>Your gym membership has expired. Please renew your membership to continue accessing the gym.</p>`
        : `<p>This is a reminder that your gym membership will expire in <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong>.</p>
           <p>Please renew your membership to avoid any interruption in service.</p>`
      }
      <p>Thank you.</p>
    </div>
  `;
  
  return { subject, text, html };
};

const getSuperAdminSummaryEmail = (expiredOwners: Array<{ name: string; email: string; planName: string }>) => {
  const subject = `Daily Subscription Expiration Report - ${expiredOwners.length} Owner${expiredOwners.length !== 1 ? "s" : ""} Expired`;
  
  const ownerList = expiredOwners
    .map((owner) => `- ${owner.name} (${owner.email}) - Plan: ${owner.planName}`)
    .join("\n");
  
  const text = `Daily Subscription Expiration Report\n\n${expiredOwners.length} owner subscription${expiredOwners.length !== 1 ? "s have" : " has"} expired today:\n\n${ownerList}\n\nPlease follow up with these owners to renew their subscriptions.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p><strong>${expiredOwners.length}</strong> owner subscription${expiredOwners.length !== 1 ? "s have" : " has"} expired today:</p>
      <ul>
        ${expiredOwners.map((owner) => `<li><strong>${owner.name}</strong> (${owner.email}) - Plan: ${owner.planName}</li>`).join("")}
      </ul>
      <p>Please follow up with these owners to renew their subscriptions.</p>
    </div>
  `;
  
  return { subject, text, html };
};

const getGymOwnerSummaryEmail = (expiredMembers: Array<{ name: string; email: string }>) => {
  const subject = `Daily Membership Expiration Report - ${expiredMembers.length} Member${expiredMembers.length !== 1 ? "s" : ""} Expired`;
  
  const memberList = expiredMembers
    .map((member) => `- ${member.name} (${member.email})`)
    .join("\n");
  
  const text = `Daily Membership Expiration Report\n\n${expiredMembers.length} member subscription${expiredMembers.length !== 1 ? "s have" : " has"} expired today:\n\n${memberList}\n\nPlease follow up with these members to renew their memberships.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p><strong>${expiredMembers.length}</strong> member subscription${expiredMembers.length !== 1 ? "s have" : " has"} expired today:</p>
      <ul>
        ${expiredMembers.map((member) => `<li><strong>${member.name}</strong> (${member.email})</li>`).join("")}
      </ul>
      <p>Please follow up with these members to renew their memberships.</p>
    </div>
  `;
  
  return { subject, text, html };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const cronSecret = getCronSecret(req);
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: "Unauthorized" });
  }

  try {
    // ========== OWNER SUBSCRIPTIONS ==========

    const activeOwnerSubscriptions = await prisma.ownerSubscription.findMany({
      where: {
        is_active: true,
        is_deleted: false,
        is_expired: false,
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
        plan: {
          select: {
            name: true,
          },
        },
      },
    });

    const expiredOwnersToday: Array<{ name: string; email: string; planName: string }> = [];
    let ownerRemindersSent = 0;

    const ownerActions = computeOwnerActions(activeOwnerSubscriptions);

    for (const action of ownerActions) {
      if (action.type === "EXPIRE") {
        await prisma.ownerSubscription.update({
          where: { id: action.id },
          data: {
            is_expired: true,
            notification_sent: true,
          },
        });

        if (action.ownerEmail && action.ownerName && action.planName) {
          const { subject, text, html } = getOwnerReminderEmail(
            action.ownerName,
            0,
            action.planName
          );

          try {
            await sendEmail(action.ownerEmail, subject, text, html);
            expiredOwnersToday.push({
              name: action.ownerName,
              email: action.ownerEmail,
              planName: action.planName,
            });
          } catch (error) {
            console.error(`Failed to send email to ${action.ownerEmail}:`, error);
          }
        }
      } else if (
        (action.type === "FIRST_REMINDER" || action.type === "SECOND_REMINDER") &&
        action.email &&
        action.planName
      ) {
        const { subject, text, html } = getOwnerReminderEmail(
          action.name,
          action.daysLeft,
          action.planName
        );

        try {
          await sendEmail(action.email, subject, text, html);

          await prisma.ownerSubscription.update({
            where: { id: action.id },
            data: {
              first_reminder_sent: action.type === "FIRST_REMINDER",
              second_reminder_sent: action.type === "SECOND_REMINDER",
            },
          });
          ownerRemindersSent++;
        } catch (error) {
          console.error(`Failed to send reminder email to ${action.email}:`, error);
        }
      }
    }

    if (expiredOwnersToday.length > 0) {
      const superAdmins = await prisma.user.findMany({
        where: {
          role: "SUPER_ADMIN",
          is_active: true,
          is_deleted: false,
          email: { not: null },
        },
        select: { email: true },
      });

      const { subject, text, html } = getSuperAdminSummaryEmail(expiredOwnersToday);

      for (const admin of superAdmins) {
        if (admin.email) {
          try {
            await sendEmail(admin.email, subject, text, html);
          } catch (error) {
            console.error(`Failed to send summary email to super admin ${admin.email}:`, error);
          }
        }
      }
    }

    // ========== MEMBER SUBSCRIPTIONS ==========

    const activeMemberSubscriptions = await prisma.memberSubscription.findMany({
      where: {
        is_active: true,
        is_deleted: false,
        is_expired: false,
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

    const expiredMembersByOwner = new Map<
      string,
      Array<{ name: string; email: string; ownerEmail: string }>
    >();
    let memberRemindersSent = 0;

    const memberSubsById = new Map(
      activeMemberSubscriptions.map((sub) => [sub.id, sub])
    );
    const memberActions = computeMemberActions(activeMemberSubscriptions);

    for (const action of memberActions) {
      if (action.type === "EXPIRE") {
        await prisma.memberSubscription.update({
          where: { id: action.id },
          data: {
            is_expired: true,
            notification_sent: true,
          },
        });

        const subscription = memberSubsById.get(action.id);
        if (subscription?.member.user.email && action.ownerName) {
          const { subject, text, html } = getMemberReminderEmail(action.ownerName, 0);

          try {
            await sendEmail(subscription.member.user.email, subject, text, html);

            const ownerId = subscription.member.gym.owner.id;
            const ownerEmail = subscription.member.gym.owner.email || "";

            if (!expiredMembersByOwner.has(ownerId)) {
              expiredMembersByOwner.set(ownerId, []);
            }

            expiredMembersByOwner.get(ownerId)?.push({
              name: action.ownerName,
              email: subscription.member.user.email,
              ownerEmail,
            });
          } catch (error) {
            console.error(
              `Failed to send email to member ${subscription.member.user.email}:`,
              error
            );
          }
        }
      } else if (
        (action.type === "FIRST_REMINDER" || action.type === "SECOND_REMINDER") &&
        action.email
      ) {
        const { subject, text, html } = getMemberReminderEmail(
          action.name,
          action.daysLeft
        );

        try {
          await sendEmail(action.email, subject, text, html);

          await prisma.memberSubscription.update({
            where: { id: action.id },
            data: {
              first_reminder_sent: action.type === "FIRST_REMINDER",
              second_reminder_sent: action.type === "SECOND_REMINDER",
            },
          });
          memberRemindersSent++;
        } catch (error) {
          console.error(`Failed to send reminder email to member ${action.email}:`, error);
        }
      }
    }

    for (const [, expiredMembers] of expiredMembersByOwner.entries()) {
      if (expiredMembers.length > 0 && expiredMembers[0].ownerEmail) {
        const { subject, text, html } = getGymOwnerSummaryEmail(expiredMembers);

        try {
          await sendEmail(expiredMembers[0].ownerEmail, subject, text, html);
        } catch (error) {
          console.error(
            `Failed to send summary email to gym owner ${expiredMembers[0].ownerEmail}:`,
            error
          );
        }
      }
    }

    return res.status(StatusCodes.OK).json({
      message: "Subscription check completed",
      summary: {
        ownerSubscriptions: {
          expired: expiredOwnersToday.length,
          remindersSent: ownerRemindersSent,
        },
        memberSubscriptions: {
          expired: Array.from(expiredMembersByOwner.values()).flat().length,
          remindersSent: memberRemindersSent,
        },
      },
    });
  } catch (error) {
    console.error("Error in subscription check cron job:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: message,
    });
  }
}
