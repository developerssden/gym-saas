// pages/api/payments/generateinvoice.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireAdminOrOwner } from "@/lib/sessioncheck";
import { SubscriptionTypeEnum } from "@/prisma/generated/client";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireAdminOrOwner(req, res);
  if (!session) return;

  const isGymOwner = session.user.role === "GYM_OWNER";

  try {
    const { payment_id } = req.body;

    if (!payment_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Payment ID is required",
      });
    }

    // Get payment with related subscription data
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        ownerSubscription: {
          include: {
            plan: true,
            owner: true,
          },
        },
        memberSubscription: {
          include: {
            member: {
              include: {
                user: true,
                gym: {
                  include: {
                    owner: true,
                  },
                },
                location: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Payment not found",
      });
    }

    // For gym owners: verify they own the member's gym
    if (isGymOwner) {
      if (
        payment.subscription_type !== SubscriptionTypeEnum.MEMBER ||
        !payment.memberSubscription ||
        payment.memberSubscription.member.gym.owner_id !== session.user.id
      ) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: "Forbidden – You can only generate invoices for your members' payments",
        });
      }
    }

    // Determine subscription type and get relevant data
    const isOwnerSubscription = payment.subscription_type === SubscriptionTypeEnum.OWNER;
    const isMemberSubscription = payment.subscription_type === SubscriptionTypeEnum.MEMBER;

    if (!isOwnerSubscription && !isMemberSubscription) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid subscription type",
      });
    }

    let customer: any;
    let sub: any;
    let plan: any;
    let gym: any;

    if (isOwnerSubscription) {
      if (!payment.ownerSubscription) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Owner subscription not found",
        });
      }
      sub = payment.ownerSubscription;
      customer = sub.owner;
      plan = sub.plan;
    } else {
      if (!payment.memberSubscription) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Member subscription not found",
        });
      }
      sub = payment.memberSubscription;
      customer = sub.member.user;
      gym = sub.member.gym;
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="invoice-${payment.id}.pdf"`);
      res.send(pdfBuffer);
    });

    // Helper function to format currency (PKR)
    const formatCurrency = (amount: number) => {
      const safe = Number.isFinite(amount) ? amount : 0;
      return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 0,
      }).format(safe);
    };

    // Helper function to format date
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("INVOICE", 50, 50, { align: "center" })
      .moveDown(0.5);

    // Define column boundaries to prevent overlap
    const leftColumnX = 50;
    const leftColumnWidth = 280; // Left column ends at 330
    const rightColumnX = 360; // Start right column after left column with gap
    const rightColumnWidth = 190; // Right column from 360 to 550
    
    // Invoice details section (left side)
    const invoiceDetailsY = 120;
    let leftY = invoiceDetailsY;
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Invoice #: ${payment.id.substring(0, 8).toUpperCase()}`, leftColumnX, leftY, { width: leftColumnWidth })
      .text(`Date: ${formatDate(payment.payment_date)}`, leftColumnX, (leftY += 15), { width: leftColumnWidth })
      .text(`Payment Method: ${payment.payment_method === "CASH" ? "Cash" : "Bank Transfer"}`, leftColumnX, (leftY += 15), { width: leftColumnWidth });
    
    if (isOwnerSubscription || isMemberSubscription) {
      doc.text(
        `Subscription Period: ${formatDate(sub.start_date)} - ${formatDate(sub.end_date)}`,
        leftColumnX,
        (leftY += 15),
        { width: leftColumnWidth }
      );
    }

    if (payment.transaction_id) {
      doc.text(`Transaction ID: ${payment.transaction_id}`, leftColumnX, (leftY += 15), { width: leftColumnWidth });
    }

    // Company/Business Info (right side) - positioned in separate column
    let rightY = invoiceDetailsY;
    
    if (isMemberSubscription && gym) {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(gym.name || "Gym", rightColumnX, rightY, { align: "right", width: rightColumnWidth })
        .font("Helvetica")
        .fontSize(9);
      
      if (gym.address) {
        rightY += 15;
        doc.text(gym.address, rightColumnX, rightY, { align: "right", width: rightColumnWidth });
      }
      if (gym.city && gym.state) {
        rightY += 15;
        doc.text(`${gym.city}, ${gym.state} ${gym.zip_code || ""}`, rightColumnX, rightY, { align: "right", width: rightColumnWidth });
      }
      if (gym.country) {
        rightY += 15;
        doc.text(gym.country, rightColumnX, rightY, { align: "right", width: rightColumnWidth });
      }
      if (gym.phone_number) {
        rightY += 15;
        doc.text(`Phone: ${gym.phone_number}`, rightColumnX, rightY, { align: "right", width: rightColumnWidth });
      }
    } else {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Gym SaaS", rightColumnX, rightY, { align: "right", width: rightColumnWidth })
        .font("Helvetica")
        .fontSize(9);
      rightY += 15;
      doc.text("123 Business Street", rightColumnX, rightY, { align: "right", width: rightColumnWidth });
      rightY += 15;
      doc.text("City, State 12345", rightColumnX, rightY, { align: "right", width: rightColumnWidth });
      rightY += 15;
      doc.text("United States", rightColumnX, rightY, { align: "right", width: rightColumnWidth });
      rightY += 15;
    }

    // Bill To section - use the maximum Y position from left or right side, plus generous spacing
    const maxY = Math.max(leftY, rightY);
    const billToY = maxY + 50; // Increased spacing to prevent overlap
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Bill To:", leftColumnX, billToY)
      .font("Helvetica")
      .fontSize(10);
    
    let billToCurrentY = billToY + 20;
    doc.text(`${customer.first_name} ${customer.last_name}`, leftColumnX, billToCurrentY, { width: leftColumnWidth });

    if (customer.email) {
      billToCurrentY += 15;
      doc.text(customer.email, leftColumnX, billToCurrentY, { width: leftColumnWidth });
    }

    if (customer.phone_number) {
      billToCurrentY += 15;
      doc.text(customer.phone_number, leftColumnX, billToCurrentY, { width: leftColumnWidth });
    }

    const addressLines = [
      customer.address,
      `${customer.city}, ${customer.state} ${customer.zip_code}`,
      customer.country,
    ].filter(Boolean);

    addressLines.forEach((line) => {
      billToCurrentY += 15;
      doc.text(line, leftColumnX, billToCurrentY, { width: leftColumnWidth });
    });

    // Items table - position after Bill To section with proper spacing
    const tableTop = billToCurrentY + 50;
    const rowHeight = 30;
    const tableX = 50;
    const tableWidth = 500;

    // Column layout (prevents text overlap)
    const descWidth = 360;
    const amountWidth = tableWidth - descWidth;

    const descX = tableX + 10;
    const amountX = tableX + descWidth;

    // Table header
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .rect(tableX, tableTop, tableWidth, rowHeight)
      .stroke();

    doc.text("Description", descX, tableTop + 10, { width: descWidth - 10 });
    doc.text("Amount", amountX, tableTop + 10, { width: amountWidth - 10, align: "right" });

    // Table row
    const rowY = tableTop + rowHeight;
    doc
      .font("Helvetica")
      .rect(tableX, rowY, tableWidth, rowHeight)
      .stroke();

    // Description based on subscription type
    if (isOwnerSubscription && plan) {
      doc.text(`${plan.name} - ${sub.billing_model} Subscription`, descX, rowY + 10, {
        width: descWidth - 10,
        ellipsis: true,
      });
    } else if (isMemberSubscription) {
      const description = `Member Subscription - ${sub.billing_model} (${formatDate(sub.start_date)} to ${formatDate(sub.end_date)})`;
      doc.text(description, descX, rowY + 10, {
        width: descWidth - 10,
        ellipsis: true,
      });
    }
    doc.text(formatCurrency(payment.amount), amountX, rowY + 10, { width: amountWidth - 10, align: "right" });

    // Notes section (if exists)
    let notesY = rowY + rowHeight + 20;
    if (payment.notes) {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Notes:", 50, notesY)
        .font("Helvetica")
        .fontSize(9)
        .text(payment.notes, 50, notesY + 15, { width: 500 });
      notesY += 40;
    }

    // Total section
    const totalY = notesY + 20;
    const totalBoxWidth = 200;
    const totalBoxX = 50 + tableWidth - totalBoxWidth;

    doc
      .rect(totalBoxX, totalY, totalBoxWidth, 60)
      .stroke()
      .fontSize(10)
      .font("Helvetica")
      .text("Subtotal:", totalBoxX + 10, totalY + 10)
      .text(formatCurrency(payment.amount), totalBoxX + 100, totalY + 10, { align: "right" })
      .font("Helvetica-Bold")
      .text("Total:", totalBoxX + 10, totalY + 35)
      .text(formatCurrency(payment.amount), totalBoxX + 100, totalY + 35, { align: "right" });

    // Footer
    const footerY = 750;
    doc
      .fontSize(8)
      .font("Helvetica")
      .text("Thank you for your business!", 50, footerY, { align: "center" })
      .text("This is a computer-generated invoice.", 50, footerY + 15, { align: "center" });

    // Finalize PDF
    doc.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
