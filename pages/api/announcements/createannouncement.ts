// pages/api/announcements/createAnnouncement.ts
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
    const { title, message, audience, is_active, recipient_user_id } =
      req.body as {
        title?: string;
        message?: string;
        audience?: AnnouncementAudience | "ALL" | "GYM_OWNER" | "MEMBER";
        is_active?: boolean;
        recipient_user_id?: string | null;
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

    const recipientUserId =
      typeof recipient_user_id === "string" && recipient_user_id.trim()
        ? recipient_user_id.trim()
        : null;

    if (recipientUserId) {
      if (nextAudience === "ALL") {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Pick Gym Owner or Member as the audience for an individual send.",
        });
      }
      const recipient = await resolveAnnouncementRecipient(
        nextAudience,
        recipientUserId
      );
      if (!recipient) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: "Recipient must be an active gym owner or member matching the selected audience.",
        });
      }
    }

    const created = await prisma.announcement.create({
      data: {
        title,
        message,
        audience: nextAudience,
        is_active: is_active ?? true,
        recipient_user_id: recipientUserId,
      },
    });

    let emailReport: { total: number; sent: number; failed: number } | null =
      null;
    if (created.is_active) {
      const delivery = {
        title: created.title,
        message: created.message,
        audience: created.audience,
        recipientUserId: created.recipient_user_id,
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
