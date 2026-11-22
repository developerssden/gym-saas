// Pure part of member phone search (see phone-search.ts), safe for tests and the client.

const MIN_DIGITS = 3;
/** Country calling code stripped as an alternative, so "+92 301" also finds "0301…". */
const HOME_CALLING_CODE = "92";

/**
 * Digit strings to look for when `search` looks like a phone number, or null
 * when it's a name or email (has letters) or too short to be useful. The
 * national 0 and international 00 are dropped; a leading 92 is also tried
 * without it.
 */
export function phoneSearchDigits(search: string | null | undefined): string[] | null {
  if (typeof search !== "string") return null;
  const trimmed = search.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length < MIN_DIGITS) return null;
  const variants = [digits];
  const local = digits.slice(HOME_CALLING_CODE.length);
  if (digits.startsWith(HOME_CALLING_CODE) && local.length >= MIN_DIGITS) variants.push(local);
  return variants;
}
