// pages/api/payments/generateinvoice.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { SubscriptionTypeEnum } from "@/prisma/generated/client";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

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
                gym: true,
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

    // Only generate invoice for owner subscriptions
    if (payment.subscription_type !== SubscriptionTypeEnum.OWNER || !payment.ownerSubscription) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invoice can only be generated for owner subscription payments",
      });
    }

    const sub = payment.ownerSubscription;
    const customer = sub.owner;
    const plan = sub.plan;

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

    // Helper function to format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
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

    // Invoice details section
    const invoiceDetailsY = 120;
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Invoice #: ${payment.id.substring(0, 8).toUpperCase()}`, 50, invoiceDetailsY)
      .text(`Date: ${formatDate(payment.payment_date)}`, 50, invoiceDetailsY + 15)
      .text(`Payment Method: ${payment.payment_method === "CASH" ? "Cash" : "Bank Transfer"}`, 50, invoiceDetailsY + 30)
      .text(
        `Subscription Period: ${formatDate(sub.start_date)} - ${formatDate(sub.end_date)}`,
        50,
        invoiceDetailsY + 45
      );

    if (payment.transaction_id) {
      doc.text(`Transaction ID: ${payment.transaction_id}`, 50, invoiceDetailsY + 60);
    }

    // Company/Business Info (right side)
    const companyY = invoiceDetailsY;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Gym SaaS", 400, companyY, { align: "right" })
      .font("Helvetica")
      .fontSize(9)
      .text("123 Business Street", 400, companyY + 15, { align: "right" })
      .text("City, State 12345", 400, companyY + 30, { align: "right" })
      .text("United States", 400, companyY + 45, { align: "right" });

    // Bill To section
    const billToY = invoiceDetailsY + 95;
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Bill To:", 50, billToY)
      .font("Helvetica")
      .fontSize(10)
      .text(`${customer.first_name} ${customer.last_name}`, 50, billToY + 20);

    if (customer.email) {
      doc.text(customer.email, 50, billToY + 35);
    }

    doc.text(customer.phone_number, 50, billToY + 50);

    const addressLines = [
      customer.address,
      `${customer.city}, ${customer.state} ${customer.zip_code}`,
      customer.country,
    ].filter(Boolean);

    addressLines.forEach((line, index) => {
      doc.text(line, 50, billToY + 65 + index * 15);
    });

    // Items table (subscriptions are single charges; quantity/unit price aren't meaningful here)
    const tableTop = billToY + 140;
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

    // Keep the line-item description short; the subscription period is already displayed above.
    doc.text(`${plan.name} - ${sub.billing_model} Subscription`, descX, rowY + 10, {
      width: descWidth - 10,
      ellipsis: true,
    });
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
