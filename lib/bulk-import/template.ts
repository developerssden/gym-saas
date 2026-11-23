import * as XLSX from "xlsx";
import { IMPORT_COLUMNS } from "./columns";

const requiredText = (r: (typeof IMPORT_COLUMNS)[number]["required"]) =>
  r === "always" ? "Yes" : r === "membership" ? "With memberships" : "No";

/** Just the header row: an example row would be imported as a real member if left in. */
export function buildTemplateCsv(): string {
  return `${IMPORT_COLUMNS.map((c) => c.label).join(",")}\n`;
}

/**
 * "Members": just the header row. "How to fill in": every column, whether
 * it's needed, an example and a note.
 */
export function buildTemplateXlsxBuffer(): Buffer {
  const members = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS.map((c) => c.label)]);
  members["!cols"] = IMPORT_COLUMNS.map((c) => ({ wch: Math.max(c.label.length, c.example.length, 12) + 2 }));

  const help = XLSX.utils.aoa_to_sheet([
    ["Column", "Needed?", "Example", "Notes"],
    ...IMPORT_COLUMNS.map((c) => [c.label, requiredText(c.required), c.example, c.hint ?? ""]),
    [],
    ["Dates can be written as 31/01/2026 or 2026-01-31. Fill in one member per row on the Members sheet."],
  ]);
  help["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 60 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, members, "Members");
  XLSX.utils.book_append_sheet(workbook, help, "How to fill in");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
