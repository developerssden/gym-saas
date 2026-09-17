/** Normalize to UTC midnight so ClassAttendance unique key is per calendar day. */
export function attendanceDateOnly(input: string | Date): Date {
  const raw = typeof input === "string" ? input : input.toISOString();
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) {
      throw new Error("Invalid attendance_date");
    }
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
