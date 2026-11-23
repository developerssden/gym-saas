import { test } from "node:test";
import assert from "node:assert/strict";
import { columnKeyForHeader, IMPORT_COLUMNS } from "@/lib/bulk-import/columns";
import { rowsFromRecords } from "@/lib/bulk-import/parse-spreadsheet";
import { buildTemplateCsv } from "@/lib/bulk-import/template";
import { duplicatesInFile, parseImportDate, parsePaidBy, validateImportRow } from "@/lib/bulk-import/validate-row";
import type { ParsedImportRow, ValidatedImportRow } from "@/lib/bulk-import/types";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

test("headers in plain words and the old snake_case both work", () => {
  assert.equal(columnKeyForHeader("Full name"), "full_name");
  assert.equal(columnKeyForHeader("full_name"), "full_name");
  assert.equal(columnKeyForHeader(" Phone "), "phone_number");
  assert.equal(columnKeyForHeader("phone_number"), "phone_number");
  assert.equal(columnKeyForHeader("Fee paid"), "price");
  assert.equal(columnKeyForHeader("price"), "price");
  assert.equal(columnKeyForHeader("Paid by"), "payment_method");
  assert.equal(columnKeyForHeader("Bank reference"), "transaction_id");
  assert.equal(columnKeyForHeader("Something else"), undefined);
});

test("the CSV template is just the plain headers, with no example member", () => {
  assert.equal(buildTemplateCsv(), `${IMPORT_COLUMNS.map((c) => c.label).join(",")}\n`);
  assert.ok(buildTemplateCsv().startsWith("Full name,Phone,"));
});

test("rows: plain headers map to fields, numbers and Excel dates become text, empty rows are skipped", () => {
  const rows = rowsFromRecords([
    { "Full name": "Ali Khan", Phone: "0300 1234567", "Fee paid": 5000, "Start date": new Date(2026, 10, 1) },
    { "Full name": "", Phone: "" },
    { first_name: "Sara", last_name: "Ahmed", phone_number: "03011234567" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].full_name, "Ali Khan");
  assert.equal(rows[0].price, "5000");
  assert.equal(rows[0].start_date, "2026-11-01");
  assert.equal(rows[0].rowNumber, 2);
  assert.equal(rows[1].full_name, "Sara Ahmed");
  assert.equal(rows[1].rowNumber, 4);
});

test("row numbers follow Excel's, even after blank rows", () => {
  const record = { "Full name": "Ali", Phone: "1" };
  Object.defineProperty(record, "__rowNum__", { value: 6, enumerable: false });
  assert.equal(rowsFromRecords([record])[0].rowNumber, 7);
});

test("dates: day first or year first, real days only", () => {
  assert.deepEqual(parseImportDate("2026-01-31"), utc(2026, 1, 31));
  assert.deepEqual(parseImportDate("31/01/2026"), utc(2026, 1, 31));
  assert.deepEqual(parseImportDate("1-2-2026"), utc(2026, 2, 1));
  assert.deepEqual(parseImportDate("01.02.2026"), utc(2026, 2, 1));
  assert.equal(parseImportDate(""), null);
  assert.equal(parseImportDate("31/02/2026"), "invalid");
  assert.equal(parseImportDate("next week"), "invalid");
});

test("paid by: Cash or Bank transfer in any case; empty is cash", () => {
  assert.equal(parsePaidBy(""), "CASH");
  assert.equal(parsePaidBy("cash"), "CASH");
  assert.equal(parsePaidBy("CASH"), "CASH");
  assert.equal(parsePaidBy("Bank transfer"), "BANK_TRANSFER");
  assert.equal(parsePaidBy("BANK_TRANSFER"), "BANK_TRANSFER");
  assert.equal(parsePaidBy("cheque"), null);
});

const row = (fields: Partial<ParsedImportRow>): ParsedImportRow => ({
  rowNumber: 2,
  full_name: "Ali Khan",
  phone_number: "0300 1234567",
  email: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "",
  date_of_birth: "",
  cnic: "",
  start_date: "01/11/2026",
  end_date: "",
  months: "1",
  price: "5,000",
  payment_method: "",
  transaction_id: "",
  payment_date: "",
  ...fields,
});

const errorOf = (r: ParsedImportRow, mode: "members_only" | "member_with_subscription" = "member_with_subscription") => {
  const v = validateImportRow(r, mode);
  return v.ok ? null : v.error;
};

test("a full membership row is read correctly", () => {
  const v = validateImportRow(row({}), "member_with_subscription");
  assert.ok(v.ok);
  assert.equal(v.data.price, 5000);
  assert.deepEqual(v.data.start_date, utc(2026, 11, 1));
  assert.deepEqual(v.data.end_date, utc(2026, 12, 1));
  assert.deepEqual(v.data.payment_date, utc(2026, 11, 1));
  assert.equal(v.data.payment_method, "CASH");
});

test("errors name the column in plain words and say how to fix it", () => {
  assert.equal(errorOf(row({ phone_number: "" })), "Phone is missing");
  assert.equal(errorOf(row({ full_name: " " })), "Full name is missing");
  assert.equal(errorOf(row({ start_date: "" })), "Start date is missing");
  assert.equal(errorOf(row({ price: "" })), "Fee paid is missing");
  assert.equal(errorOf(row({ start_date: "soon" })), 'Start date "soon" isn\'t a date. Write it like 31/01/2026');
  assert.equal(errorOf(row({ months: "", end_date: "" })), "Fill in Months or End date, so we know when the membership ends");
  assert.equal(errorOf(row({ payment_method: "cheque" })), 'Paid by "cheque" must be Cash or Bank transfer');
  assert.equal(errorOf(row({ payment_method: "Bank transfer" })), "Bank reference is missing (needed for bank transfers)");
  assert.equal(errorOf(row({ email: "ali@" })), 'Email "ali@" doesn\'t look like an email address');
});

test("members only: membership columns are not needed", () => {
  assert.equal(errorOf(row({ start_date: "", price: "", months: "" }), "members_only"), null);
});

test("repeated phones (any format) and emails in the file are flagged after the first", () => {
  const v = (n: number, phone: string, email = "") =>
    ({ rowNumber: n, phone_number: phone, email }) as ValidatedImportRow;
  const result = duplicatesInFile([
    v(2, "0300 1234567"),
    v(3, "03001234567"),
    v(4, "0311 0000000", "a@b.com"),
    v(5, "0322 0000000", "A@B.com"),
  ]);
  assert.deepEqual([...result], [
    [3, "Same phone as row 2"],
    [5, "Same email as row 4"],
  ]);
});

test("a real Excel file: the Members sheet is read, with dates, numbers and blank rows", async () => {
  const XLSX = await import("xlsx");
  const { parseSpreadsheetBuffer } = await import("@/lib/bulk-import/parse-spreadsheet");
  const help = XLSX.utils.aoa_to_sheet([["Column", "Needed?"], ["Full name", "Yes"]]);
  const members = XLSX.utils.aoa_to_sheet(
    [
      ["Full name", "Phone", "Start date", "Months", "Fee paid"],
      ["Ali Khan", "03001234567", new Date(2026, 10, 1), 1, 5000],
      [],
      ["Sara Ahmed", "03011234567", "15/11/2026", 3, 12000],
    ],
    { cellDates: true }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, help, "How to fill in");
  XLSX.utils.book_append_sheet(wb, members, "Members");
  const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  const rows = parseSpreadsheetBuffer(buffer, "members.xlsx");
  assert.deepEqual(
    rows.map((r) => [r.rowNumber, r.full_name, r.phone_number, r.start_date, r.months, r.price]),
    [
      [2, "Ali Khan", "03001234567", "2026-11-01", "1", "5000"],
      [4, "Sara Ahmed", "03011234567", "15/11/2026", "3", "12000"],
    ]
  );
});
