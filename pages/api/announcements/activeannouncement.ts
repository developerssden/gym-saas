// pages/api/announcements/activeAnnouncement.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import sendEmail from "@/lib/sendEmail";
import { AnnouncementAudience, Role } from "@/prisma/generated/client";

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
      <p style="margin:0; white-space:pre-line;">${escapeHtml(input.message)}</p>
    </div>
  `;

  const chunkSize = 10;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);
    const results = await Promise.allSettled(chunk.map((to) => sendEmail(to, subject, text, html)));
    for (const r of results) {
      if (r.status === "fulfilled") sent += 1;
      else failed += 1;
    }
  }

  return { total: emails.length, sent, failed };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { id } = req.body as { id?: string };
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Announcement ID is required" });

    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { is_active: true, is_deleted: true, title: true, message: true, audience: true },
    });
    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Announcement not found" });
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: { is_active: !existing.is_active },
    });

    let emailReport: { total: number; sent: number; failed: number } | null = null;
    // If we just activated it, email the audience
    if (!existing.is_active && updated.is_active) {
      emailReport = await sendAnnouncementEmails({
        title: existing.title,
        message: existing.message,
        audience: existing.audience as AnnouncementAudience,
      });
    }

    return res.status(StatusCodes.OK).json({
      message: updated.is_active ? "Announcement activated" : "Announcement deactivated",
      data: updated,
      email: emailReport,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}


