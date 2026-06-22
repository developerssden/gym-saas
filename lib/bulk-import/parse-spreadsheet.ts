import * as XLSX from "xlsx";
import type { ParsedImportRow } from "./types";

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  filename: string
): ParsedImportRow[] {
  const isCsv = filename.toLowerCase().endsWith(".csv");
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Spreadsheet has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    throw new Error("Spreadsheet is empty");
  }

  const rows: ParsedImportRow[] = rawRows.map((raw, index) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      normalized[normalizeHeader(key)] = cellToString(value);
    }

    return {
      rowNumber: index + 2,
      full_name:
        normalized.full_name ??
        [normalized.first_name, normalized.last_name]
          .filter(Boolean)
          .join(" ")
          .trim(),
      phone_number: normalized.phone_number ?? "",
      email: normalized.email ?? "",
      address: normalized.address ?? "",
      city: normalized.city ?? "",
      state: normalized.state ?? "",
      zip_code: normalized.zip_code ?? "",
      country: normalized.country ?? "",
      date_of_birth: normalized.date_of_birth ?? "",
      cnic: normalized.cnic ?? "",
      start_date: normalized.start_date ?? "",
      end_date: normalized.end_date ?? "",
      months: normalized.months ?? "",
      price: normalized.price ?? "",
      payment_method: normalized.payment_method ?? "",
      transaction_id: normalized.transaction_id ?? "",
      payment_date: normalized.payment_date ?? "",
    };
  });

  if (isCsv && rows.length === 0) {
    throw new Error("CSV file has no data rows");
  }

  return rows;
}
