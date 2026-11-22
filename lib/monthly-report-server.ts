// Loads and renders the monthly report (PDF and Excel). Calculations live in
// lib/monthly-report.ts; the queries here use the same filters as the owner
// dashboard so the numbers match it.
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import prisma from "@/lib/prisma";
import { ownedGymWhere, type Access } from "@/lib/access";
import { SubscriptionTypeEnum } from "@/prisma/generated/client";
import { calendarMonthRange, formatCalendarDate } from "@/lib/date-utils";
import { formatCurrency, resolveGymCountry } from "@/lib/currency";
import { churnReasonLabel } from "@/lib/churn-reasons";
import { billingModelLabel, buildMonthlyReport, type MonthlyReport } from "@/lib/monthly-report";

export type ReportScope = {
  month: string;
  gym_id?: string;
  location_id?: string;
};

export type LoadedReport = {
  report: MonthlyReport;
  /** Gym (and location) the report covers, for titles. */
  scopeLabel: string;
  /** Country used to pick the currency. */
  countryCode: string | null;
};

/** Null when the month is invalid. */
export async function loadMonthlyReport(access: Access, scope: ReportScope): Promise<LoadedReport | null> {
  const range = calendarMonthRange(scope.month);
  if (!range) return null;
  const { gym_id, location_id } = scope;

  const gymFilter = {
    AND: [ownedGymWhere(access)],
    is_deleted: false,
    ...(gym_id ? { id: gym_id } : {}),
  };
  const memberFilter = {
    gym: gymFilter,
    ...(gym_id ? { gym_id } : {}),
    ...(location_id ? { location_id } : {}),
  };

  const [payments, expenses, newMembers, subscriptions, gyms, location] = await Promise.all([
    prisma.payment.findMany({
      where: {
        subscription_type: SubscriptionTypeEnum.MEMBER,
        payment_date: { gte: range.start, lt: range.end },
        memberSubscription: { member: memberFilter },
      },
      select: { amount: true, payment_method: true, payment_date: true },
    }),
    prisma.expense.findMany({
      where: {
        is_deleted: false,
        expense_date: { gte: range.start, lt: range.end },
        gym: gymFilter,
        ...(location_id ? { location_id } : {}),
      },
      select: { amount: true, category: true },
    }),
    prisma.member.count({
      where: { ...memberFilter, joinedAt: { gte: range.start, lt: range.end } },
    }),
    prisma.memberSubscription.findMany({
      where: { is_deleted: false, member: memberFilter },
      select: {
        id: true,
        member_id: true,
        price: true,
        discount: true,
        admission_fee: true,
        billing_model: true,
        start_date: true,
        end_date: true,
        createdAt: true,
        churn_reason: true,
        churn_note: true,
        payments: { select: { amount: true, payment_date: true } },
        member: { select: { user: { select: { first_name: true, last_name: true, phone_number: true } } } },
      },
    }),
    prisma.gym.findMany({ where: gymFilter, select: { name: true, country: true }, orderBy: { name: "asc" } }),
    location_id
      ? prisma.location.findFirst({ where: { id: location_id, gym: gymFilter }, select: { name: true, country: true } })
      : Promise.resolve(null),
  ]);

  const report = buildMonthlyReport({
    month: scope.month,
    range,
    now: new Date(),
    payments: payments.map(p => ({ ...p, payment_method: String(p.payment_method) })),
    expenses: expenses.map(e => ({ amount: e.amount, category: String(e.category) })),
    newMembers,
    subscriptions: subscriptions.map(s => ({
      id: s.id,
      member_id: s.member_id,
      member_name: `${s.member.user.first_name ?? ""} ${s.member.user.last_name ?? ""}`.trim() || "Member",
      member_phone: s.member.user.phone_number ?? null,
      price: s.price,
      discount: s.discount,
      admission_fee: s.admission_fee,
      billing_model: String(s.billing_model),
      start_date: s.start_date,
      end_date: s.end_date,
      createdAt: s.createdAt,
      churn_reason: s.churn_reason,
      churn_note: s.churn_note,
      payments: s.payments,
    })),
  });

  const gymLabel = gym_id ? gyms[0]?.name ?? "Gym" : gyms.length === 1 ? gyms[0].name : "All gyms";
  return {
    report,
    scopeLabel: location ? `${gymLabel} · ${location.name}` : gymLabel,
    countryCode: resolveGymCountry(gyms[0]?.country, location?.country),
  };
}

const shortDate = (d: Date) => {
  const [y, m, day] = formatCalendarDate(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function reportFileName(loaded: LoadedReport, ext: "pdf" | "xlsx"): string {
  const slug = loaded.scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gym";
  return `monthly-report-${slug}-${loaded.report.month}.${ext}`;
}

// ---------------------------------------------------------------- Excel

export function renderReportXlsx({ report, scopeLabel }: LoadedReport): Buffer {
  const m = report.money;
  const mem = report.members;
  const summary: (string | number)[][] = [
    [`Monthly report: ${report.monthLabel}`],
    [scopeLabel],
    report.isCurrentMonth ? ["Month in progress: figures so far"] : [],
    [],
    ["Money", "Amount"],
    ["Collected from members", m.collected],
    ["Expenses", m.expenses],
    ["Profit", m.profit],
    ["Outstanding (unpaid fees)", m.outstanding],
    ["Members owing", m.outstandingMembers],
    [],
    ["Collected by method", "Amount", "Payments"],
    ...m.collectedByMethod.map(r => [r.label, r.amount, r.count]),
    [],
    ["Expenses by category", "Amount"],
    ...m.expensesByCategory.map(r => [r.label, r.amount]),
    [],
    ["Members", "Count"],
    ["New members", mem.newMembers],
    ["Subscriptions started", mem.newSubscriptions],
    ["of which renewals", mem.renewals],
    ["Subscriptions ending", mem.expiries],
    ["Members lost", mem.lost],
    [],
    ["Why members left", "Count"],
    ...mem.lostByReason.map(r => [r.label, r.count]),
    [],
    ["Top plans (subscriptions started)", "Price", "Count"],
    ...report.topPlans.map(p => [p.label, p.price, p.count]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = [{ wch: 34 }, { wch: 14 }, { wch: 10 }];

  const expiries = XLSX.utils.json_to_sheet(
    report.expiryList.map(e => ({
      Member: e.member_name,
      Phone: e.member_phone ?? "",
      "End date": shortDate(e.end_date),
      Plan: billingModelLabel(e.billing_model),
      Price: e.price,
      Status: e.renewed ? "Renewed" : e.lost ? "Lost" : "Not ended yet",
      "Reason left": e.lost ? churnReasonLabel(e.churn_reason) : "",
      Note: e.lost ? e.churn_note ?? "" : "",
    })),
    { header: ["Member", "Phone", "End date", "Plan", "Price", "Status", "Reason left", "Note"] }
  );
  expiries["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 30 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, expiries, "Expiries");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ---------------------------------------------------------------- PDF

export function renderReportPdf({ report, scopeLabel, countryCode }: LoadedReport): Promise<Buffer> {
  const money = (n: number) => formatCurrency(n, { countryCode });
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const buffers: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", b => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;

  doc.font("Helvetica-Bold").fontSize(18).text(`Monthly report: ${report.monthLabel}`);
  doc.font("Helvetica").fontSize(10).fillColor("#555555").text(scopeLabel);
  if (report.isCurrentMonth) doc.text("Month in progress: figures so far.");
  doc.text(`Generated ${shortDate(new Date())}`);
  doc.fillColor("#000000").moveDown(1);

  // Key figures as boxes
  const m = report.money;
  const boxes: Array<[string, string]> = [
    ["Collected", money(m.collected)],
    ["Expenses", money(m.expenses)],
    ["Profit", money(m.profit)],
    ["Outstanding", money(m.outstanding)],
  ];
  const gap = 8;
  const boxW = (width - gap * (boxes.length - 1)) / boxes.length;
  const boxY = doc.y;
  boxes.forEach(([label, value], i) => {
    const x = left + i * (boxW + gap);
    doc.roundedRect(x, boxY, boxW, 48, 4).lineWidth(0.5).strokeColor("#cccccc").stroke();
    doc.font("Helvetica").fontSize(9).fillColor("#555555").text(label, x + 8, boxY + 8, { width: boxW - 16 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#000000").text(value, x + 8, boxY + 24, { width: boxW - 16 });
  });
  doc.x = left;
  doc.y = boxY + 60;

  const heading = (text: string) => {
    if (doc.y + 60 > bottom) doc.addPage();
    doc.moveDown(0.5).font("Helvetica-Bold").fontSize(12).fillColor("#000000").text(text, left, doc.y).moveDown(0.3);
  };

  const table = (headers: string[], widths: number[], rows: string[][], empty = "None") => {
    const draw = (values: string[], bold: boolean) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      const height = Math.max(...values.map((v, i) => doc.heightOfString(v, { width: widths[i] - 6 }))) + 8;
      if (doc.y + height > bottom) doc.addPage();
      const y = doc.y;
      let x = left;
      values.forEach((v, i) => {
        doc.text(v, x + 3, y + 4, { width: widths[i] - 6 });
        x += widths[i];
      });
      doc.moveTo(left, y + height).lineTo(x, y + height).lineWidth(0.5).strokeColor("#dddddd").stroke();
      doc.x = left;
      doc.y = y + height;
    };
    draw(headers, true);
    if (rows.length === 0) draw([empty, ...headers.slice(1).map(() => "")], false);
    rows.forEach(r => draw(r, false));
  };

  heading("Money");
  table(
    ["", "Amount"],
    [width * 0.6, width * 0.4],
    [
      ["Collected from members", `${money(m.collected)} (${m.paymentsCount} payment${m.paymentsCount === 1 ? "" : "s"})`],
      ...m.collectedByMethod.map(r => [`   ${r.label}`, money(r.amount)]),
      ["Expenses", money(m.expenses)],
      ...m.expensesByCategory.map(r => [`   ${r.label}`, money(r.amount)]),
      ["Profit", money(m.profit)],
      ["Outstanding (unpaid fees)", `${money(m.outstanding)} from ${m.outstandingMembers} member${m.outstandingMembers === 1 ? "" : "s"}`],
    ]
  );

  const mem = report.members;
  heading("Members");
  table(
    ["", "Count"],
    [width * 0.6, width * 0.4],
    [
      ["New members", String(mem.newMembers)],
      ["Subscriptions started", `${mem.newSubscriptions} (${mem.renewals} renewal${mem.renewals === 1 ? "" : "s"})`],
      ["Subscriptions ending", String(mem.expiries)],
      ["Members lost (ended, not renewed)", String(mem.lost)],
    ]
  );

  heading("Why members left");
  table(["Reason", "Members"], [width * 0.6, width * 0.4], mem.lostByReason.map(r => [r.label, String(r.count)]), "No members lost");

  heading("Top plans");
  table(
    ["Plan", "Price", "Started"],
    [width * 0.4, width * 0.3, width * 0.3],
    report.topPlans.map(p => [p.label, money(p.price), String(p.count)]),
    "No subscriptions started"
  );

  heading("Subscriptions ending this month");
  table(
    ["Member", "Phone", "End date", "Status", "Reason left"],
    [width * 0.25, width * 0.18, width * 0.16, width * 0.15, width * 0.26],
    report.expiryList.map(e => [
      e.member_name,
      e.member_phone ?? "-",
      shortDate(e.end_date),
      e.renewed ? "Renewed" : e.lost ? "Lost" : "Not ended yet",
      e.lost ? churnReasonLabel(e.churn_reason) : "",
    ]),
    "No subscriptions ending"
  );

  doc.end();
  return done;
}
