import type { PaymentRecorder } from "@/types";

/** "Ali Khan (staff)", "Sara Ahmed (owner)", or "-" when unknown. */
export function recordedByLabel(recorder: PaymentRecorder | null | undefined): string {
  if (!recorder) return "-";
  const name = [recorder.first_name, recorder.last_name].filter(Boolean).join(" ");
  if (recorder.role === "STAFF") return name ? `${name} (staff)` : "Staff";
  if (recorder.role === "GYM_OWNER") return name ? `${name} (owner)` : "Owner";
  return name || "-";
}
