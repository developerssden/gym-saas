// pages/api/announcements/createAnnouncement.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { AnnouncementAudience, Role } from "@/prisma/generated/client";
import sendEmail from "@/lib/sendEmail";

const allowedAudiences: AnnouncementAudience[] = ["ALL", "GYM_OWNER", "MEMBER"];

const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

async function sendAnnouncementEmails(input: {
  title: string;
  message: string;
  audience: AnnouncementAudience;
}) {
  const roles: Role[] =
    input.audience === "ALL"
      ? [Role.GYM_OWNER, Role.MEMBER]
      : [input.audience === "GYM_OWNER" ? Role.GYM_OWNER : Role.MEMBER];

  const recipients = await prisma.user.findMany({
    where: {
      is_deleted: false,
      is_active: true,
      role: { in: roles },
      email: { not: null },
    },
    select: { email: true },
  });

  const emails = recipients
    .map((r) => (r.email ?? "").trim())
    .filter((e) => e.length > 0);

  const subject = `Announcement: ${input.title}`;
  const text = `${input.title}\n\n${input.message}\n`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <h2 style="margin:0 0 12px 0;">${escapeHtml(input.title)}</h2>
      <p style="margin:0; white-space:pre-line;">${escapeHtml(
        input.message
      )}</p>
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST")
    return res
      .status(StatusCodes.METHOD_NOT_ALLOWED)
      .json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { title, message, audience, is_active } = req.body as {
      title?: string;
      message?: string;
      audience?: AnnouncementAudience | "ALL" | "GYM_OWNER" | "MEMBER";
      is_active?: boolean;
    };

    if (!title || !message) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Missing required fields: title, message" });
    }

    const nextAudience = ((audience as AnnouncementAudience) ??
      AnnouncementAudience.ALL) as AnnouncementAudience;
    if (!allowedAudiences.includes(nextAudience)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid audience. Must be ALL, GYM_OWNER, or MEMBER",
      });
    }

    const created = await prisma.announcement.create({
      data: {
        title,
        message,
        audience: nextAudience,
        is_active: is_active ?? true,
      },
    });

    let emailReport: { total: number; sent: number; failed: number } | null =
      null;
    if (created.is_active) {
      // Send immediately when created as active
      emailReport = await sendAnnouncementEmails({
        title: created.title,
        message: created.message,
        audience: created.audience,
      });
    }

    return res.status(StatusCodes.CREATED).json({
      message: "Announcement created successfully",
      data: created,
      email: emailReport,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}
