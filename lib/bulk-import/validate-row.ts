import type { ImportMode, ParsedImportRow, ValidatedImportRow } from "./types";
import { splitFullName } from "./split-full-name";
import { columnLabel, type ImportColumnKey } from "./columns";

class RowError extends Error {}

/**
 * A day from "2026-01-31", "31/01/2026", "31-01-2026" or "31.01.2026"
 * (day first, as written in Pakistan), at UTC midnight. Null when empty.
 */
export function parseImportDate(value: string): Date | null | "invalid" {
  const v = value.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return "invalid";
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejects 31/02/2026 and the like.
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : "invalid";
}

function dateField(row: ParsedImportRow, key: ImportColumnKey): Date | null {
  const parsed = parseImportDate(row[key]);
  if (parsed === "invalid") throw new RowError(`${columnLabel(key)} "${row[key]}" isn't a date. Write it like 31/01/2026`);
  return parsed;
}

function wholeNumberField(row: ParsedImportRow, key: ImportColumnKey): number | null {
  const v = row[key].replace(/,/g, "").trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new RowError(`${columnLabel(key)} "${row[key]}" must be a whole number above 0`);
  return n;
}

/** "Cash" / "Bank transfer" (any case), or the old CASH / BANK_TRANSFER. Empty means cash. */
export function parsePaidBy(value: string): "CASH" | "BANK_TRANSFER" | null {
  const v = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (!v || v === "cash") return "CASH";
  if (v === "bank" || v === "bank transfer" || v === "transfer" || v === "online") return "BANK_TRANSFER";
  return null;
}

const missing = (key: ImportColumnKey) => new RowError(`${columnLabel(key)} is missing`);

/** Checks one row; the error names the column and says how to fix it. */
export function validateImportRow(
  row: ParsedImportRow,
  mode: ImportMode
): { ok: true; data: ValidatedImportRow } | { ok: false; error: string } {
  try {
    if (!row.full_name.trim()) throw missing("full_name");
    if (!row.phone_number.trim()) throw missing("phone_number");
    if (row.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
      throw new RowError(`Email "${row.email.trim()}" doesn't look like an email address`);
    }

    const { first_name, last_name } = splitFullName(row.full_name);

    const validated: ValidatedImportRow = {
      rowNumber: row.rowNumber,
      first_name,
      last_name,
      phone_number: row.phone_number.trim(),
      email: row.email.trim(),
      address: row.address.trim(),
      city: row.city.trim(),
      state: row.state.trim(),
      zip_code: row.zip_code.trim(),
      country: row.country.trim(),
      date_of_birth: dateField(row, "date_of_birth"),
      cnic: row.cnic.trim() || null,
    };

    if (mode === "member_with_subscription") {
      const startDate = dateField(row, "start_date");
      if (!startDate) throw missing("start_date");
      const price = wholeNumberField(row, "price");
      if (price === null) throw missing("price");

      const months = wholeNumberField(row, "months");
      const endDate = dateField(row, "end_date");
      if (!months && !endDate) throw new RowError("Fill in Months or End date, so we know when the membership ends");

      let finalEndDate: Date;
      if (endDate) {
        if (endDate <= startDate) throw new RowError("End date must be after the start date");
        finalEndDate = endDate;
      } else {
        finalEndDate = new Date(startDate);
        finalEndDate.setUTCMonth(finalEndDate.getUTCMonth() + (months as number));
      }

      const paymentMethod = parsePaidBy(row.payment_method);
      if (!paymentMethod) throw new RowError(`Paid by "${row.payment_method}" must be Cash or Bank transfer`);

      const transactionId = row.transaction_id.trim() || null;
      if (paymentMethod === "BANK_TRANSFER" && !transactionId) {
        throw new RowError("Bank reference is missing (needed for bank transfers)");
      }

      validated.start_date = startDate;
      validated.end_date = finalEndDate;
      validated.months = months ?? undefined;
      validated.price = price;
      validated.payment_method = paymentMethod;
      validated.transaction_id = transactionId;
      validated.payment_date = dateField(row, "payment_date") ?? startDate;
    }

    return { ok: true, data: validated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "This row couldn't be read" };
  }
}

/**
 * Rows that repeat a phone number or email from an earlier row in the same
 * file: row number → why. The first row keeps the member; repeats are skipped.
 */
export function duplicatesInFile(rows: ValidatedImportRow[]): Map<number, string> {
  const phones = new Map<string, number>();
  const emails = new Map<string, number>();
  const result = new Map<number, string>();
  for (const row of rows) {
    const phone = row.phone_number.replace(/\D/g, "");
    const email = row.email.trim().toLowerCase();
    const samePhone = phone ? phones.get(phone) : undefined;
    const sameEmail = email ? emails.get(email) : undefined;
    if (samePhone !== undefined) result.set(row.rowNumber, `Same phone as row ${samePhone}`);
    else if (sameEmail !== undefined) result.set(row.rowNumber, `Same email as row ${sameEmail}`);
    else {
      if (phone) phones.set(phone, row.rowNumber);
      if (email) emails.set(email, row.rowNumber);
    }
  }
  return result;
}
