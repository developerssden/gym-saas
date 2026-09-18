// pages/api/announcements/activeAnnouncement.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { AnnouncementAudience } from "@/prisma/generated/client";
import {
  sendAnnouncementEmails,
  sendAnnouncementInAppNotifications,
} from "@/lib/notifications/announcement-fanout";

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
      select: {
        is_active: true,
        is_deleted: true,
        title: true,
        message: true,
        audience: true,
        recipient_user_id: true,
      },
    });
    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Announcement not found" });
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: { is_active: !existing.is_active },
    });

    let emailReport: { total: number; sent: number; failed: number } | null = null;
    if (!existing.is_active && updated.is_active) {
      const delivery = {
        title: existing.title,
        message: existing.message,
        audience: existing.audience as AnnouncementAudience,
        recipientUserId: existing.recipient_user_id,
      };
      emailReport = await sendAnnouncementEmails(delivery);
      try {
        await sendAnnouncementInAppNotifications(delivery);
      } catch (err: unknown) {
        console.error("[in-app-notification] failed to fan out announcement notifications", {
          message: err instanceof Error ? err.message : err,
        });
      }
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
