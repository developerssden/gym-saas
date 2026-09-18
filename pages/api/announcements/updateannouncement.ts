// pages/api/announcements/updateAnnouncement.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { AnnouncementAudience } from "@/prisma/generated/client";
import {
  resolveAnnouncementRecipient,
  sendAnnouncementEmails,
  sendAnnouncementInAppNotifications,
} from "@/lib/notifications/announcement-fanout";

const allowedAudiences: AnnouncementAudience[] = ["ALL", "GYM_OWNER", "MEMBER"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { id, title, message, audience, is_active, recipient_user_id } = req.body as {
      id?: string;
      title?: string;
      message?: string;
      audience?: AnnouncementAudience;
      is_active?: boolean;
      recipient_user_id?: string | null;
    };
    if (!id) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Announcement ID is required" });

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing || existing.is_deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Announcement not found" });
    }

    const nextAudience =
      audience !== undefined ? (audience as AnnouncementAudience) : existing.audience;
    if (audience !== undefined && !allowedAudiences.includes(nextAudience)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid audience. Must be ALL, GYM_OWNER, or MEMBER",
      });
    }

    const recipientProvided = recipient_user_id !== undefined;
    const nextRecipientId = recipientProvided
      ? typeof recipient_user_id === "string" && recipient_user_id.trim()
        ? recipient_user_id.trim()
        : null
      : existing.recipient_user_id;

    if (nextRecipientId) {
      if (nextAudience === "ALL") {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Pick Gym Owner or Member as the audience for an individual send.",
        });
      }
      const recipient = await resolveAnnouncementRecipient(nextAudience, nextRecipientId);
      if (!recipient) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Recipient must be an active gym owner or member matching the selected audience.",
        });
      }
    }

    const nextIsActive =
      is_active !== undefined ? Boolean(is_active) : Boolean(existing.is_active);

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(message !== undefined ? { message } : {}),
        ...(audience !== undefined ? { audience: nextAudience } : {}),
        ...(is_active !== undefined ? { is_active: nextIsActive } : {}),
        ...(recipientProvided ? { recipient_user_id: nextRecipientId } : {}),
      },
    });

    let emailReport: { total: number; sent: number; failed: number } | null = null;
    if (!existing.is_active && nextIsActive) {
      const delivery = {
        title: updated.title,
        message: updated.message,
        audience: updated.audience as AnnouncementAudience,
        recipientUserId: updated.recipient_user_id,
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
      message: "Announcement updated successfully",
      data: updated,
      email: emailReport,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
