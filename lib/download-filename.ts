import { DEFAULT_BUSINESS_TIME_ZONE, formatCalendarDate } from "@/lib/date-utils";

/**
 * Readable names for downloaded files, e.g.
 * "Receipt - Ali Khan - 25 Nov 2026 3.45 PM.pdf".
 * The server builds the name and sends it in Content-Disposition, and the
 * browser code reads it back with `filenameFromDisposition`.
 */

/** Removes characters Windows and macOS don't allow in file names. */
export function cleanFilePart(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
}

/** "25 Nov 2026" in the business time zone. */
export function fileDate(date: Date, timeZone = DEFAULT_BUSINESS_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** "25 Nov 2026 3.45 PM" in the business time zone. Uses "." because ":" isn't allowed in Windows file names. */
export function fileDateTime(date: Date, timeZone = DEFAULT_BUSINESS_TIME_ZONE): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(date)
    .replace(":", ".")
    .replace(/\s+/g, " ")
    .toUpperCase();
  return `${fileDate(date, timeZone)} ${time}`;
}

/** Joins the parts with " - ", skipping empty ones: ["Receipt", "Ali Khan", "25 Nov 2026"] → "Receipt - Ali Khan - 25 Nov 2026.pdf". */
export function downloadFileName(parts: Array<string | null | undefined>, ext: string): string {
  const name = parts.map(cleanFilePart).filter(Boolean).join(" - ") || "Download";
  return `${name}.${ext}`;
}

/**
 * When a payment was made, for its receipt's file name. The payment date is
 * often just a day (midnight), so the time comes from when it was recorded,
 * and only if that was on the same day.
 */
export function paymentFileDate(paymentDate: Date, recordedAt: Date, timeZone = DEFAULT_BUSINESS_TIME_ZONE): string {
  return formatCalendarDate(paymentDate, timeZone) === formatCalendarDate(recordedAt, timeZone)
    ? fileDateTime(recordedAt, timeZone)
    : fileDate(paymentDate, timeZone);
}

/** ASCII-only copy of the name for old browsers that ignore `filename*`. */
function asciiFileName(filename: string): string {
  return filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Content-Disposition header that keeps spaces and non-English names (e.g. Urdu) intact. */
export function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiFileName(filename) || "download"}"; filename*=UTF-8''${encoded}`;
}

/** Reads the file name back from a Content-Disposition header (prefers the UTF-8 one). */
export function filenameFromDisposition(header: string | null | undefined, fallback: string): string {
  if (!header) return fallback;
  const utf8 = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      // Malformed: fall back to the plain one.
    }
  }
  const plain = header.match(/filename\s*=\s*"([^"]+)"/i) ?? header.match(/filename\s*=\s*([^;]+)/i);
  return plain?.[1].trim() || fallback;
}
