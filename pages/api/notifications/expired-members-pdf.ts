import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import PDFDocument from "pdfkit";
import prisma from "@/lib/prisma";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { parseExpiredMembersNotice } from "@/lib/notifications/expired-members-notice";
import { notificationsErrorResponse } from "@/lib/notifications/api-error";

const MAX_ENTRIES = 500;

function displayDate(calendarDate: string) {
  const [year, month, day] = calendarDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

  const session = await requireGymOwner(req, res);
  if (!session) return;

  const notice = parseExpiredMembersNotice(req.query);
  if (!notice || notice.entries.length > MAX_ENTRIES) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "Invalid expired members link" });
  }

  try {
    const subscriptions = await prisma.memberSubscription.findMany({
      where: {
        id: { in: notice.entries.map((entry) => entry.subscriptionId) },
        member: { gym: { owner_id: session.user.id } },
      },
      select: {
        id: true,
        member: {
          select: {
            gym: { select: { name: true } },
            user: {
              select: {
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
                address: true,
              },
            },
          },
        },
      },
    });

    const byId = new Map(subscriptions.map((sub) => [sub.id, sub]));
    const rows = notice.entries.flatMap((entry) => {
      const sub = byId.get(entry.subscriptionId);
      if (!sub) return [];
      const user = sub.member.user;
      return [
        {
          name:
            `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Member",
          gym: sub.member.gym?.name || "—",
          email: user.email?.trim() || "—",
          phone: user.phone_number?.trim() || "—",
          address: user.address?.trim() || "—",
          start: displayDate(entry.startDate),
          end: displayDate(entry.endDate),
        },
      ];
    });

    if (rows.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "No expired members found for this notice" });
    }

    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="expired-members-${notice.date}.pdf"`
      );
      res.send(Buffer.concat(buffers));
    });

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Expired Members", { align: "left" })
      .moveDown(0.25)
      .fontSize(10)
      .font("Helvetica")
      .text(
        `${rows.length} membership${rows.length === 1 ? "" : "s"} expired on ${displayDate(notice.date)}`
      )
      .moveDown(1);

    const columns = [
      { label: "Name", key: "name", width: 110 },
      { label: "Gym", key: "gym", width: 90 },
      { label: "Email", key: "email", width: 140 },
      { label: "Phone", key: "phone", width: 85 },
      { label: "Address", key: "address", width: 155 },
      { label: "Start", key: "start", width: 90 },
      { label: "End", key: "end", width: 90 },
    ] as const;
    const left = doc.page.margins.left;
    const bottom = doc.page.height - doc.page.margins.bottom;

    const drawRow = (
      values: Record<(typeof columns)[number]["key"], string> | null,
      bold: boolean
    ) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      const height =
        Math.max(
          ...columns.map((col) =>
            doc.heightOfString(values ? values[col.key] : col.label, {
              width: col.width - 6,
            })
          )
        ) + 8;
      if (doc.y + height > bottom) doc.addPage();
      const y = doc.y;
      let x = left;
      for (const col of columns) {
        doc.text(values ? values[col.key] : col.label, x + 3, y + 4, {
          width: col.width - 6,
        });
        x += col.width;
      }
      doc
        .moveTo(left, y + height)
        .lineTo(x, y + height)
        .lineWidth(0.5)
        .strokeColor("#cccccc")
        .stroke();
      doc.x = left;
      doc.y = y + height;
    };

    drawRow(null, true);
    for (const row of rows) drawRow(row, false);

    doc.end();
  } catch (err: unknown) {
    const { status, body } = notificationsErrorResponse(
      "[notifications/expired-members-pdf]",
      err,
      "Failed to generate expired members PDF."
    );
    return res.status(status).json(body);
  }
}
