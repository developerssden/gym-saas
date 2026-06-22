import type { ImportMode, ParsedImportRow, ValidatedImportRow } from "./types";
import { splitFullName } from "./split-full-name";

function parseDate(value: string, field: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${field}: use YYYY-MM-DD`);
  }
  return date;
}

function parsePositiveInt(value: string, field: string): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid ${field}: must be a positive number`);
  }
  return num;
}

export function validateImportRow(
  row: ParsedImportRow,
  mode: ImportMode
): { ok: true; data: ValidatedImportRow } | { ok: false; error: string } {
  const displayName = row.full_name.trim() || `Row ${row.rowNumber}`;

  try {
    if (!row.full_name.trim()) throw new Error("full_name is required");
    if (!row.phone_number) throw new Error("phone_number is required");

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
      date_of_birth: parseDate(row.date_of_birth, "date_of_birth"),
      cnic: row.cnic.trim() || null,
    };

    if (mode === "member_with_subscription") {
      if (!row.start_date) throw new Error("start_date is required");
      if (!row.price) throw new Error("price is required");

      const startDate = parseDate(row.start_date, "start_date");
      if (!startDate) throw new Error("start_date is required");

      const price = parsePositiveInt(row.price, "price");
      if (price === null) throw new Error("price is required");

      const months = row.months ? parsePositiveInt(row.months, "months") : null;
      const endDate = row.end_date ? parseDate(row.end_date, "end_date") : null;

      if (!months && !endDate) {
        throw new Error("Either end_date or months is required");
      }

      let finalEndDate: Date;
      if (endDate) {
        if (endDate <= startDate) {
          throw new Error("end_date must be after start_date");
        }
        finalEndDate = endDate;
      } else {
        finalEndDate = new Date(startDate);
        finalEndDate.setMonth(finalEndDate.getMonth() + (months as number));
      }

      const paymentMethod = (row.payment_method.trim().toUpperCase() || "CASH") as
        | "CASH"
        | "BANK_TRANSFER";

      if (paymentMethod !== "CASH" && paymentMethod !== "BANK_TRANSFER") {
        throw new Error("payment_method must be CASH or BANK_TRANSFER");
      }

      const transactionId = row.transaction_id.trim() || null;
      if (paymentMethod === "BANK_TRANSFER" && !transactionId) {
        throw new Error("transaction_id is required for BANK_TRANSFER");
      }

      const paymentDate = row.payment_date
        ? parseDate(row.payment_date, "payment_date")
        : startDate;

      validated.start_date = startDate;
      validated.end_date = finalEndDate;
      validated.months = months ?? undefined;
      validated.price = price;
      validated.payment_method = paymentMethod;
      validated.transaction_id = transactionId;
      validated.payment_date = paymentDate ?? startDate;
    }

    return { ok: true, data: validated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return { ok: false, error: `${displayName}: ${message}` };
  }
}
