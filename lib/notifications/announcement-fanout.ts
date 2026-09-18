import prisma from "@/lib/prisma";
import sendEmail from "@/lib/sendEmail";
import { escapeHtml } from "@/lib/email/escape-html";
import { createInAppNotification } from "@/lib/notifications/create-notification";
import { AnnouncementAudience, Role } from "@/prisma/generated/client";

export type AnnouncementDeliveryInput = {
  title: string;
  message: string;
  audience: AnnouncementAudience;
  recipientUserId?: string | null;
};

export type AnnouncementRecipient = {
  id: string;
  email: string | null;
};

export function audienceRoles(audience: AnnouncementAudience): Role[] {
  if (audience === "ALL") return [Role.GYM_OWNER, Role.MEMBER];
  return [audience === "GYM_OWNER" ? Role.GYM_OWNER : Role.MEMBER];
}

export async function resolveAnnouncementRecipient(
  audience: AnnouncementAudience,
  recipientUserId: string
): Promise<AnnouncementRecipient | null> {
  const allowedRoles = audienceRoles(audience);
  const user = await prisma.user.findFirst({
    where: {
      id: recipientUserId,
      is_deleted: false,
      is_active: true,
      role: { in: allowedRoles },
    },
    select: { id: true, email: true },
  });
  return user;
}

export async function resolveAnnouncementRecipients(
  input: AnnouncementDeliveryInput
): Promise<AnnouncementRecipient[]> {
  if (input.recipientUserId) {
    const user = await resolveAnnouncementRecipient(
      input.audience,
      input.recipientUserId
    );
    return user ? [user] : [];
  }

  return prisma.user.findMany({
    where: {
      is_deleted: false,
      is_active: true,
      role: { in: audienceRoles(input.audience) },
    },
    select: { id: true, email: true },
  });
}

export async function sendAnnouncementEmails(input: AnnouncementDeliveryInput) {
  const recipients = await resolveAnnouncementRecipients(input);
  const emails = recipients
    .map((r) => (r.email ?? "").trim())
    .filter((e) => e.length > 0);

  const subject = `Announcement: ${input.title}`;
  const text = `${input.title}\n\n${input.message}\n`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <h2 style="margin:0 0 12px 0;">${escapeHtml(input.title)}</h2>
      <p style="margin:0; white-space:pre-line;">${escapeHtml(input.message)}</p>
    </div>
  `;

  const chunkSize = 10;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((to) => sendEmail(to, subject, text, html))
    );
    for (const r of results) {
      if (r.status === "fulfilled") sent += 1;
      else failed += 1;
    }
  }

  return { total: emails.length, sent, failed };
}

export async function sendAnnouncementInAppNotifications(
  input: AnnouncementDeliveryInput
) {
  const recipients = await resolveAnnouncementRecipients(input);

  const chunkSize = 10;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((user) =>
        createInAppNotification(user.id, {
          title: input.title,
          body: input.message,
          type: "announcement",
        })
      )
    );
  }
}
