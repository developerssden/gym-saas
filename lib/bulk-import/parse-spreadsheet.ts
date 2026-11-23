import * as XLSX from "xlsx";
import type { ParsedImportRow } from "./types";
import { IMPORT_COLUMNS, columnKeyForHeader, normalizeHeader, type ImportColumnKey } from "./columns";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Excel dates arrive as Date objects at (about) local midnight; some come out a
 * few seconds before it, so round to the nearest day before reading the date.
 */
function excelDateToString(d: Date): string {
  const r = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  return `${r.getFullYear()}-${pad(r.getMonth() + 1)}-${pad(r.getDate())}`;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return excelDateToString(value);
  return String(value).trim();
}

/** Turns spreadsheet rows (header → cell) into import rows. Pure, for tests. */
export function rowsFromRecords(records: Array<Record<string, unknown>>): ParsedImportRow[] {
  const rows: ParsedImportRow[] = [];
  records.forEach((raw, index) => {
    const values = {} as Record<ImportColumnKey, string>;
    for (const c of IMPORT_COLUMNS) values[c.key] = "";
    let firstName = "";
    let lastName = "";
    for (const [header, value] of Object.entries(raw)) {
      const text = cellToString(value);
      const key = columnKeyForHeader(header);
      if (key) values[key] = text;
      else if (normalizeHeader(header) === "first_name") firstName = text;
      else if (normalizeHeader(header) === "last_name") lastName = text;
    }
    if (!values.full_name) values.full_name = [firstName, lastName].filter(Boolean).join(" ");
    // Rows with nothing filled in (e.g. formatted but empty) aren't members.
    if (Object.values(values).every((v) => !v)) return;
    // The row number as Excel shows it. SheetJS skips blank rows but keeps each
    // row's real position (0-based) in __rowNum__; otherwise the header is row 1.
    const rowNum = (raw as { __rowNum__?: unknown }).__rowNum__;
    rows.push({ rowNumber: typeof rowNum === "number" ? rowNum + 1 : index + 2, ...values });
  });
  return rows;
}

export function parseSpreadsheetBuffer(buffer: Buffer, filename: string): ParsedImportRow[] {
  void filename;
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  // The template's members are on "Members"; other files use their first sheet.
  const sheetName = workbook.SheetNames.includes("Members") ? "Members" : workbook.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets");

  // raw: true keeps numbers as numbers ("5,000" would read as 5) and dates as dates.
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: "",
    raw: true,
  });
  return rowsFromRecords(records);
}
