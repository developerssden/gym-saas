import { countries } from "country-data-list";

/**
 * Click-to-chat helpers. Kettlio never sends WhatsApp messages itself: these
 * build `wa.me` links that open the gym owner's own WhatsApp with the message
 * already typed, so no WhatsApp Business number or API is needed.
 */

const DEFAULT_CALLING_CODE = "92"; // Pakistan

type CountryRecord = { alpha2?: string; alpha3?: string; countryCallingCodes?: string[] };

/** "PK" / "PAK" → "92". Falls back to Pakistan. */
export function callingCodeForCountry(countryCode?: string | null): string {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return DEFAULT_CALLING_CODE;
  const country = (countries.all as CountryRecord[]).find(
    (c) => c.alpha2 === code || c.alpha3 === code
  );
  const calling = country?.countryCallingCodes?.[0]?.replace(/\D/g, "");
  return calling || DEFAULT_CALLING_CODE;
}

/**
 * Turns whatever was typed into the international digits wa.me expects.
 * "0300 1234567" → "923001234567", "+92 300-1234567" → "923001234567",
 * "0092300…" → "92300…". Returns null when it can't be a real number.
 */
export function toWhatsAppNumber(
  phone: string | null | undefined,
  countryCode?: string | null
): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (trimmed.startsWith("+")) {
    // Already international.
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = `${callingCodeForCountry(countryCode)}${digits.slice(1)}`;
  } else {
    const calling = callingCodeForCountry(countryCode);
    // A local number typed without the leading 0 (e.g. "3001234567").
    if (!digits.startsWith(calling) && digits.length <= 10) {
      digits = `${calling}${digits}`;
    }
  }

  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function buildWhatsAppUrl(number: string | null, message: string): string {
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

function formatDay(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Whole calendar days from `now` to `date` (negative when in the past). */
function daysUntil(date: Date | string, now: Date): number {
  const d = date instanceof Date ? date : new Date(date);
  const startOf = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((startOf(d) - startOf(now)) / 86_400_000);
}

export type FeeReminderInput = {
  memberName: string;
  gymName?: string | null;
  /** Already formatted in the gym's currency, e.g. "Rs 3,000". */
  amount: string;
  endDate: Date | string;
  isExpired: boolean;
  now?: Date;
};

/** The reminder an owner sends a member about their fee. */
export function buildFeeReminderMessage(input: FeeReminderInput): string {
  const name = firstName(input.memberName);
  const gym = input.gymName?.trim();
  const sign = gym ? `\n\n— ${gym}` : "";
  const day = formatDay(input.endDate);

  if (input.isExpired) {
    return `Assalam o Alaikum ${name}, your gym membership ended on ${day}. Renew for ${input.amount} to keep training — we'd love to see you back!${sign}`;
  }

  const days = daysUntil(input.endDate, input.now ?? new Date());
  const when =
    days <= 0 ? `today (${day})` : days === 1 ? `tomorrow (${day})` : `on ${day}`;
  return `Assalam o Alaikum ${name}, a reminder that your gym fee of ${input.amount} is due ${when}. Please pay at the front desk to keep your membership active. Thank you!${sign}`;
}

export type ReceiptMessageInput = {
  memberName: string;
  gymName?: string | null;
  amount: string;
  paymentDate: Date | string;
};

/** Accompanies a shared PDF receipt. */
export function buildReceiptMessage(input: ReceiptMessageInput): string {
  const name = firstName(input.memberName);
  const gym = input.gymName?.trim();
  return `Assalam o Alaikum ${name}, thank you for your payment of ${input.amount} on ${formatDay(input.paymentDate)}${gym ? ` at ${gym}` : ""}. Your receipt is attached.${gym ? `\n\n— ${gym}` : ""}`;
}
