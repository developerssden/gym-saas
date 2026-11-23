// The import file's columns, in plain words. The template, the page and the
// parser all read this list, so the names owners see are the names we accept.
import type { ParsedImportRow } from "./types";

export type ImportColumnKey = Exclude<keyof ParsedImportRow, "rowNumber">;

export type ImportColumn = {
  key: ImportColumnKey;
  /** Header in the template, e.g. "Full name". */
  label: string;
  /** "always", only when importing memberships, or never. */
  required: "always" | "membership" | null;
  example: string;
  /** One short line for the page. */
  hint?: string;
  /** Only used when importing memberships. */
  membership?: true;
  /** Older header names still accepted (normalised), besides the key itself. */
  aliases?: string[];
};

export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: "full_name", label: "Full name", required: "always", example: "Ali Khan", aliases: ["name"] },
  {
    key: "phone_number",
    label: "Phone",
    required: "always",
    example: "0300 1234567",
    hint: "In Excel, format the column as Text so the first 0 isn't dropped.",
    aliases: ["phone", "mobile", "phone_no"],
  },
  { key: "email", label: "Email", required: null, example: "ali@example.com" },
  { key: "cnic", label: "CNIC", required: null, example: "35202-1234567-1" },
  { key: "date_of_birth", label: "Date of birth", required: null, example: "15/06/1995", aliases: ["dob"] },
  { key: "address", label: "Address", required: null, example: "123 Main Boulevard" },
  { key: "city", label: "City", required: null, example: "Lahore" },
  { key: "state", label: "Province", required: null, example: "Punjab", aliases: ["province", "state"] },
  { key: "zip_code", label: "Postcode", required: null, example: "54000", aliases: ["postcode", "postal_code", "zip"] },
  { key: "country", label: "Country", required: null, example: "Pakistan" },
  { key: "start_date", label: "Start date", required: "membership", membership: true, example: "01/11/2026" },
  {
    key: "months",
    membership: true,
    label: "Months",
    required: null,
    example: "1",
    hint: "How long the membership lasts. Fill in Months or End date.",
  },
  { key: "end_date", label: "End date", required: null, membership: true, example: "", hint: "Instead of Months, if it ends on a set day." },
  {
    key: "price",
    membership: true,
    label: "Fee paid",
    required: "membership",
    example: "5000",
    hint: "Recorded as paid in full.",
    aliases: ["fee", "fee_paid", "amount", "price"],
  },
  {
    key: "payment_method",
    membership: true,
    label: "Paid by",
    required: null,
    example: "Cash",
    hint: "Cash or Bank transfer. Empty means Cash.",
    aliases: ["paid_by", "method"],
  },
  {
    key: "transaction_id",
    membership: true,
    label: "Bank reference",
    required: null,
    example: "",
    hint: "Needed for bank transfers.",
    aliases: ["bank_reference", "reference", "transaction_id"],
  },
  { key: "payment_date", label: "Paid on", required: null, membership: true, example: "01/11/2026", hint: "Empty means the start date.", aliases: ["paid_on"] },
];

/** Lower-case, words joined by "_", other characters dropped: "Fee paid *" → "fee_paid". */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const HEADER_TO_KEY = new Map<string, ImportColumnKey>();
for (const c of IMPORT_COLUMNS) {
  for (const name of [c.key, c.label, ...(c.aliases ?? [])]) HEADER_TO_KEY.set(normalizeHeader(name), c.key);
}

/** The column a header means, in plain words or the old snake_case. */
export function columnKeyForHeader(header: string): ImportColumnKey | undefined {
  return HEADER_TO_KEY.get(normalizeHeader(header));
}

export const columnLabel = (key: ImportColumnKey) => IMPORT_COLUMNS.find((c) => c.key === key)?.label ?? key;
