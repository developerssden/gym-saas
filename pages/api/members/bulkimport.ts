import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import {
  checkLimitExceeded,
  validateOwnerSubscription,
} from "@/lib/subscription-validation";
import prisma from "@/lib/prisma";
import { parseSpreadsheetBuffer } from "@/lib/bulk-import/parse-spreadsheet";
import { validateImportRow } from "@/lib/bulk-import/validate-row";
import { importMemberRow } from "@/lib/bulk-import/import-row";
import type {
  BulkImportResponse,
  ImportMode,
  ImportRowResult,
} from "@/lib/bulk-import/types";
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from "@/lib/bulk-import/types";

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req: NextApiRequest): Promise<{
  fields: formidable.Fields;
  files: formidable.Files;
}> {
  const form = formidable({
    maxFileSize: MAX_IMPORT_FILE_BYTES,
    maxFiles: 1,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function fieldValue(fields: formidable.Fields, key: string): string {
  const val = fields[key];
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({
      message: "Method not allowed",
    });
  }

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const { fields, files } = await parseForm(req);

    const mode = fieldValue(fields, "mode") as ImportMode;
    const gymId = fieldValue(fields, "gym_id");
    const locationId = fieldValue(fields, "location_id");

    if (mode !== "members_only" && mode !== "member_with_subscription") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid mode. Use members_only or member_with_subscription",
      });
    }

    if (!gymId || !locationId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: gym_id, location_id",
      });
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, owner_id: true, is_deleted: true },
    });

    if (!gym || gym.is_deleted || gym.owner_id !== session.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "UNAUTHORIZED_GYM",
        message: "Gym does not belong to you",
      });
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, gym_id: true, is_deleted: true },
    });

    if (!location || location.is_deleted || location.gym_id !== gymId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid location_id or location does not belong to the selected gym",
      });
    }

    const subscriptionValidation = await validateOwnerSubscription(
      session.user.id
    );
    if (!subscriptionValidation.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "SUBSCRIPTION_EXPIRED",
        message: "Subscription is expired or inactive",
      });
    }

    const fileField = files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;
    if (!file) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "No file uploaded",
      });
    }

    const filename = file.originalFilename ?? file.newFilename ?? "upload.csv";
    const lowerName = filename.toLowerCase();
    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "File must be .csv or .xlsx",
      });
    }

    const buffer = fs.readFileSync(file.filepath);
    fs.unlinkSync(file.filepath);

    let rows;
    try {
      rows = parseSpreadsheetBuffer(buffer, filename);
    } catch (parseErr) {
      const message =
        parseErr instanceof Error ? parseErr.message : "Failed to parse file";
      return res.status(StatusCodes.BAD_REQUEST).json({ error: message });
    }

    if (rows.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "No data rows found in file",
      });
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: `Too many rows. Maximum is ${MAX_IMPORT_ROWS}`,
      });
    }

    const limitCheck = await checkLimitExceeded(
      session.user.id,
      "member",
      locationId
    );
    const remaining = limitCheck.max - limitCheck.current;
    if (remaining <= 0) {
      return res.status(StatusCodes.CONFLICT).json({
        error: "LIMIT_EXCEEDED",
        message: `Member limit reached for this location (max ${limitCheck.max})`,
      });
    }
    if (rows.length > remaining) {
      return res.status(StatusCodes.CONFLICT).json({
        error: "LIMIT_EXCEEDED",
        message: `Import has ${rows.length} rows but only ${remaining} member slots remain at this location`,
      });
    }

    const results: ImportRowResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const row of rows) {
      const name = row.full_name.trim() || `Row ${row.rowNumber}`;

      const validation = validateImportRow(row, mode);
      if (!validation.ok) {
        results.push({
          row: row.rowNumber,
          status: "error",
          name,
          error: validation.error,
        });
        failed++;
        continue;
      }

      try {
        const memberId = await importMemberRow(
          validation.data,
          mode,
          gymId,
          locationId,
          session.user.id
        );
        results.push({
          row: row.rowNumber,
          status: "success",
          member_id: memberId,
          name,
        });
        succeeded++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        results.push({
          row: row.rowNumber,
          status: "error",
          name,
          error: message,
        });
        failed++;
      }
    }

    const response: BulkImportResponse = {
      total: rows.length,
      succeeded,
      failed,
      results,
    };

    return res.status(StatusCodes.OK).json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
