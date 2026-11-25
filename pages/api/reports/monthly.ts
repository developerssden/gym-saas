// GET /api/reports/monthly?month=YYYY-MM&gym_id=&location_id=&format=json|pdf|xlsx
import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import { requireAccess } from "@/lib/access";
import { formatCalendarMonth } from "@/lib/date-utils";
import { contentDisposition } from "@/lib/download-filename";
import {
  loadMonthlyReport,
  renderReportPdf,
  renderReportXlsx,
  reportFileName,
} from "@/lib/monthly-report-server";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });
  }

  const access = await requireAccess(req, res, { permission: "reports.view" });
  if (!access) return;

  const month = one(req.query.month) ?? formatCalendarMonth(new Date());
  const format = (one(req.query.format) ?? "json").toLowerCase();
  if (!["json", "pdf", "xlsx"].includes(format)) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid format. Use json, pdf or xlsx" });
  }
  if (month > formatCalendarMonth(new Date())) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Pick this month or an earlier one" });
  }

  try {
    const loaded = await loadMonthlyReport(access, {
      month,
      gym_id: one(req.query.gym_id),
      location_id: one(req.query.location_id),
    });
    if (!loaded) return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid month" });

    if (format === "pdf") {
      const pdf = await renderReportPdf(loaded);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDisposition(reportFileName(loaded, "pdf")));
      return res.status(StatusCodes.OK).send(pdf);
    }
    if (format === "xlsx") {
      const xlsx = renderReportXlsx(loaded);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", contentDisposition(reportFileName(loaded, "xlsx")));
      return res.status(StatusCodes.OK).send(xlsx);
    }
    return res.status(StatusCodes.OK).json({ ...loaded.report, scopeLabel: loaded.scopeLabel });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to build the report", detail: message });
  }
}
