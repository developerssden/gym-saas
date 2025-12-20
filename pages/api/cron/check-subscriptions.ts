// pages/api/cron/check-subscriptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import sendEmail from "@/lib/sendEmail";

// Verify cron secret to prevent unauthorized access
const verifyCronSecret = (req: NextApiRequest): boolean => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.warn("CRON_SECRET not set in environment variables");
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
};

// Calculate days until expiration
const getDaysUntilExpiration = (endDate: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Check if date is today
const isToday = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return today.getTime() === checkDate.getTime();
};

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
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  // Verify cron secret (optional but recommended for security)
  // For Vercel Cron, you can also check req.headers['x-vercel-cron'] === '1'
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  if (!isVercelCron && !verifyCronSecret(req)) {
    console.warn("Unauthorized cron job attempt");
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized" });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    
    const oneDayFromNow = new Date(today);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    // ========== OWNER SUBSCRIPTIONS ==========
    
    // Get active owner subscriptions that haven't expired yet
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
    const ownerReminders: Array<{
      subscription: typeof activeOwnerSubscriptions[0];
      daysLeft: number;
      reminderType: "first" | "second" | "expired";
    }> = [];

    for (const subscription of activeOwnerSubscriptions) {
      const daysLeft = getDaysUntilExpiration(subscription.end_date);
      const isExpiredToday = isToday(subscription.end_date);

      if (isExpiredToday) {
        // Mark as expired
        await prisma.ownerSubscription.update({
          where: { id: subscription.id },
          data: {
            is_expired: true,
            notification_sent: true,
          },
        });

        // Send expiration email to owner
        if (subscription.owner.email) {
          const ownerName = `${subscription.owner.first_name} ${subscription.owner.last_name}`;
          const { subject, text, html } = getOwnerReminderEmail(
            ownerName,
            0,
            subscription.plan.name
          );
          
          try {
            await sendEmail(subscription.owner.email, subject, text, html);
            expiredOwnersToday.push({
              name: ownerName,
              email: subscription.owner.email,
              planName: subscription.plan.name,
            });
          } catch (error) {
            console.error(`Failed to send email to ${subscription.owner.email}:`, error);
          }
        }
      } else if (daysLeft === 2 && !subscription.first_reminder_sent) {
        // First reminder (2 days before)
        ownerReminders.push({ subscription, daysLeft, reminderType: "first" });
      } else if (daysLeft === 1 && !subscription.second_reminder_sent) {
        // Second reminder (1 day before)
        ownerReminders.push({ subscription, daysLeft, reminderType: "second" });
      }
    }

    // Send reminder emails to owners
    for (const reminder of ownerReminders) {
      const { subscription, daysLeft, reminderType } = reminder;
      
      if (subscription.owner.email) {
        const ownerName = `${subscription.owner.first_name} ${subscription.owner.last_name}`;
        const { subject, text, html } = getOwnerReminderEmail(
          ownerName,
          daysLeft,
          subscription.plan.name
        );
        
        try {
          await sendEmail(subscription.owner.email, subject, text, html);
          
          // Update reminder flag
          await prisma.ownerSubscription.update({
            where: { id: subscription.id },
            data: {
              first_reminder_sent: reminderType === "first",
              second_reminder_sent: reminderType === "second",
            },
          });
        } catch (error) {
          console.error(`Failed to send reminder email to ${subscription.owner.email}:`, error);
        }
      }
    }

    // Send summary email to Super Admin if there are expired owners
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
    
    // Get active member subscriptions that haven't expired yet
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

    // Group expired members by gym owner
    const expiredMembersByOwner = new Map<
      string,
      Array<{ name: string; email: string; ownerEmail: string }>
    >();

    const memberReminders: Array<{
      subscription: typeof activeMemberSubscriptions[0];
      daysLeft: number;
      reminderType: "first" | "second" | "expired";
    }> = [];

    for (const subscription of activeMemberSubscriptions) {
      const daysLeft = getDaysUntilExpiration(subscription.end_date);
      const isExpiredToday = isToday(subscription.end_date);

      if (isExpiredToday) {
        // Mark as expired
        await prisma.memberSubscription.update({
          where: { id: subscription.id },
          data: {
            is_expired: true,
            notification_sent: true,
          },
        });

        // Send expiration email to member
        if (subscription.member.user.email) {
          const memberName = `${subscription.member.user.first_name} ${subscription.member.user.last_name}`;
          const { subject, text, html } = getMemberReminderEmail(memberName, 0);
          
          try {
            await sendEmail(subscription.member.user.email, subject, text, html);
            
            // Add to owner's expired list
            const ownerId = subscription.member.gym.owner.id;
            const ownerEmail = subscription.member.gym.owner.email || "";
            
            if (!expiredMembersByOwner.has(ownerId)) {
              expiredMembersByOwner.set(ownerId, []);
            }
            
            expiredMembersByOwner.get(ownerId)?.push({
              name: memberName,
              email: subscription.member.user.email,
              ownerEmail,
            });
          } catch (error) {
            console.error(`Failed to send email to member ${subscription.member.user.email}:`, error);
          }
        }
      } else if (daysLeft === 2 && !subscription.first_reminder_sent) {
        // First reminder (2 days before)
        memberReminders.push({ subscription, daysLeft, reminderType: "first" });
      } else if (daysLeft === 1 && !subscription.second_reminder_sent) {
        // Second reminder (1 day before)
        memberReminders.push({ subscription, daysLeft, reminderType: "second" });
      }
    }

    // Send reminder emails to members
    for (const reminder of memberReminders) {
      const { subscription, daysLeft, reminderType } = reminder;
      
      if (subscription.member.user.email) {
        const memberName = `${subscription.member.user.first_name} ${subscription.member.user.last_name}`;
        const { subject, text, html } = getMemberReminderEmail(memberName, daysLeft);
        
        try {
          await sendEmail(subscription.member.user.email, subject, text, html);
          
          // Update reminder flag
          await prisma.memberSubscription.update({
            where: { id: subscription.id },
            data: {
              first_reminder_sent: reminderType === "first",
              second_reminder_sent: reminderType === "second",
            },
          });
        } catch (error) {
          console.error(`Failed to send reminder email to member ${subscription.member.user.email}:`, error);
        }
      }
    }

    // Send summary emails to gym owners
    for (const [ownerId, expiredMembers] of expiredMembersByOwner.entries()) {
      if (expiredMembers.length > 0 && expiredMembers[0].ownerEmail) {
        const { subject, text, html } = getGymOwnerSummaryEmail(expiredMembers);
        
        try {
          await sendEmail(expiredMembers[0].ownerEmail, subject, text, html);
        } catch (error) {
          console.error(`Failed to send summary email to gym owner ${expiredMembers[0].ownerEmail}:`, error);
        }
      }
    }

    return res.status(StatusCodes.OK).json({
      message: "Subscription check completed",
      summary: {
        ownerSubscriptions: {
          expired: expiredOwnersToday.length,
          remindersSent: ownerReminders.length,
        },
        memberSubscriptions: {
          expired: Array.from(expiredMembersByOwner.values()).flat().length,
          remindersSent: memberReminders.length,
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

