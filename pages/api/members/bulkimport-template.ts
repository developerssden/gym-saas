import type { NextApiRequest, NextApiResponse } from "next";
import { StatusCodes } from "http-status-codes";
import { requireAccess } from "@/lib/access";
import { buildTemplateCsv, buildTemplateXlsxBuffer } from "@/lib/bulk-import/template";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({
      message: "Method not allowed",
    });
  }

  const access = await requireAccess(req, res, { permission: "members.import" });
  if (!access) return;

  const format = (req.query.format as string)?.toLowerCase() ?? "csv";

  if (format === "xlsx") {
    const buffer = buildTemplateXlsxBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="member-import-template.xlsx"'
    );
    return res.status(StatusCodes.OK).send(buffer);
  }

  if (format === "csv") {
    const csv = buildTemplateCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="member-import-template.csv"'
    );
    return res.status(StatusCodes.OK).send(csv);
  }

  return res.status(StatusCodes.BAD_REQUEST).json({
    error: "Invalid format. Use csv or xlsx",
  });
}
