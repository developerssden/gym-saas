// "Forgot password?" rules. Pure (tested); the API routes load and save the data.

/** A reset link works for one hour, once. */
export const RESET_TOKEN_TTL_MINUTES = 60;
/** Don't send another reset email to the same account within this many seconds. */
export const RESET_EMAIL_COOLDOWN_SECONDS = 60;

/** Roles that sign in to the app with a password. Members don't. */
export const RESETTABLE_ROLES = ["GYM_OWNER", "STAFF", "SUPER_ADMIN"] as const;

/** Same reply whether or not the email has an account, so the form can't be used to find accounts. */
export const FORGOT_PASSWORD_REPLY =
  "If that email has an account, we've sent a link to reset the password. It works for 1 hour.";

export function resetTokenExpiry(now = new Date()): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True if a reset email was sent to this account too recently to send another. */
export function inCooldown(lastSentAt: Date | null | undefined, now = new Date()): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - new Date(lastSentAt).getTime() < RESET_EMAIL_COOLDOWN_SECONDS * 1000;
}

export type ResetTokenProblem = "invalid" | "used" | "expired";

/** Why a reset link can't be used, or null if it can. */
export function resetTokenProblem(
  record: { used: boolean; expires_at: Date | string; user: { is_active: boolean; is_deleted: boolean } } | null,
  now = new Date()
): ResetTokenProblem | null {
  if (!record || record.user.is_deleted || !record.user.is_active) return "invalid";
  if (record.used) return "used";
  if (now.getTime() > new Date(record.expires_at).getTime()) return "expired";
  return null;
}

export const RESET_TOKEN_MESSAGES: Record<ResetTokenProblem, string> = {
  invalid: "This reset link isn't valid. Ask for a new one.",
  used: "This reset link has already been used. Ask for a new one if you need to.",
  expired: "This reset link has expired. Links work for 1 hour. Ask for a new one.",
};
