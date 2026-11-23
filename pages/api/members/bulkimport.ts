import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { StatusCodes } from "http-status-codes";
import { requireAccess, ownsGym } from "@/lib/access";
import {
  checkLimitExceeded,
  validateOwnerSubscription,
} from "@/lib/subscription-validation";
import prisma from "@/lib/prisma";
import { parseSpreadsheetBuffer } from "@/lib/bulk-import/parse-spreadsheet";
import { duplicatesInFile, validateImportRow } from "@/lib/bulk-import/validate-row";
import { importMemberRow, rowConflict } from "@/lib/bulk-import/import-row";
import type {
  BulkImportCheckResponse,
  BulkImportResponse,
  ImportMode,
  ImportRowResult,
  ValidatedImportRow,
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

  const access = await requireAccess(req, res, { permission: "members.import" });
  if (!access) return;
  const ownerId = access.ownerId!;

  try {
    let form: Awaited<ReturnType<typeof parseForm>>;
    try {
      form = await parseForm(req);
    } catch {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: `The file is too big or couldn't be read. Upload a file under ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB.`,
      });
    }
    const { fields, files } = form;

    const mode = fieldValue(fields, "mode") as ImportMode;
    // "1": only check the rows and say which can be added; nothing is saved.
    const checkOnly = fieldValue(fields, "check_only") === "1";
    const gymId = fieldValue(fields, "gym_id");
    const locationId = fieldValue(fields, "location_id");

    if (mode !== "members_only" && mode !== "member_with_subscription") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid mode. Use members_only or member_with_subscription",
      });
    }

    if (!gymId || !locationId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Choose a gym and branch at the top of the page first",
      });
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, owner_id: true, is_deleted: true },
    });

    if (!ownsGym(access, gym)) {
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
        error: "That branch isn't part of the selected gym. Choose the branch again at the top of the page.",
      });
    }

    const subscriptionValidation = await validateOwnerSubscription(
      ownerId
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
        error: "Upload an Excel (.xlsx) or CSV file",
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
        error: "The file has no members in it. Fill in one member per row under the headings.",
      });
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: `The file has ${rows.length} rows. Import up to ${MAX_IMPORT_ROWS} at a time.`,
      });
    }

    const limitCheck = await checkLimitExceeded(ownerId, "member", locationId);
    const slotsLeft = Math.max(0, limitCheck.max - limitCheck.current);

    // Check every row first: its own values, repeats inside the file, and
    // members already saved. Nothing is written yet.
    const checked = rows.map((row) => ({
      row,
      name: row.full_name.trim() || `Row ${row.rowNumber}`,
      validation: validateImportRow(row, mode),
    }));
    const repeats = duplicatesInFile(
      checked.flatMap((c) => (c.validation.ok ? [c.validation.data] : []))
    );
    const results: ImportRowResult[] = [];
    const ready: Array<{ name: string; data: ValidatedImportRow }> = [];
    for (const { row, name, validation } of checked) {
      const error = !validation.ok
        ? validation.error
        : repeats.get(row.rowNumber) ?? (await rowConflict(validation.data, gymId, locationId));
      if (error || !validation.ok) {
        results.push({ row: row.rowNumber, status: "error", name, error: error ?? "This row couldn't be read" });
      } else {
        ready.push({ name, data: validation.data });
        results.push({ row: row.rowNumber, status: "ready", name });
      }
    }

    if (checkOnly) {
      const response: BulkImportCheckResponse = {
        total: rows.length,
        ready: ready.length,
        failed: rows.length - ready.length,
        slotsLeft,
        results: results.sort((a, b) => a.row - b.row),
      };
      return res.status(StatusCodes.OK).json(response);
    }

    if (ready.length > slotsLeft) {
      return res.status(StatusCodes.CONFLICT).json({
        error: "LIMIT_EXCEEDED",
        message:
          slotsLeft === 0
            ? `This branch has reached its member limit (${limitCheck.max}). Upgrade your plan to add more.`
            : `${ready.length} members are ready but this branch has room for ${slotsLeft} more on your plan. Remove some rows or upgrade your plan.`,
      });
    }

    let succeeded = 0;
    for (const { name, data } of ready) {
      const index = results.findIndex((r) => r.row === data.rowNumber);
      try {
        const memberId = await importMemberRow(data, mode, gymId, locationId, access.userId);
        results[index] = { row: data.rowNumber, status: "success", member_id: memberId, name };
        succeeded++;
      } catch (err) {
        results[index] = {
          row: data.rowNumber,
          status: "error",
          name,
          error: err instanceof Error ? err.message : "Couldn't be added",
        };
      }
    }

    const response: BulkImportResponse = {
      total: rows.length,
      succeeded,
      failed: rows.length - succeeded,
      results,
    };

    return res.status(StatusCodes.OK).json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
