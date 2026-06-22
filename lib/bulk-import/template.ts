import * as XLSX from "xlsx";
import { TEMPLATE_EXAMPLE_ROW, TEMPLATE_HEADERS } from "./types";

export function buildTemplateCsv(): string {
  const header = TEMPLATE_HEADERS.join(",");
  const example = TEMPLATE_HEADERS.map((key) => {
    const value = TEMPLATE_EXAMPLE_ROW[key] ?? "";
    const str = String(value);
    return str.includes(",") ? `"${str}"` : str;
  }).join(",");
  return `${header}\n${example}\n`;
}

export function buildTemplateXlsxBuffer(): Buffer {
  const sheet = XLSX.utils.json_to_sheet([TEMPLATE_EXAMPLE_ROW], {
    header: [...TEMPLATE_HEADERS],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Members");
  return Buffer.from(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  );
}
