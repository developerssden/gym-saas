import sendEmail from "@/lib/sendEmail";
import { escapeHtml } from "@/lib/email/escape-html";
import { getInviteBaseUrl } from "@/lib/invite-email";
import { APP_NAME } from "@/constants/brand";
import { RESET_TOKEN_TTL_MINUTES } from "@/lib/password-reset";

export function buildResetUrl(rawToken: string): string {
  return `${getInviteBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export function buildResetEmailHtml(resetUrl: string, firstName?: string | null): string {
  const hello = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1a1a1a;">Reset your ${APP_NAME} password</h2>
      <p style="color: #444;">${hello}</p>
      <p style="color: #444;">Someone asked to reset the password for this email. Tap the button to choose a new one.</p>
      <a href="${escapeHtml(resetUrl)}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1a1a1a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        Choose a new password
      </a>
      <p style="margin-top:24px;color:#888;font-size:13px;">The link works once, for ${RESET_TOKEN_TTL_MINUTES} minutes. If you didn't ask for this, ignore this email; your password stays the same.</p>
    </div>
  `;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, firstName?: string | null): Promise<void> {
  await sendEmail(
    email,
    `Reset your ${APP_NAME} password`,
    `Choose a new ${APP_NAME} password here (works once, for ${RESET_TOKEN_TTL_MINUTES} minutes): ${resetUrl}\n\nIf you didn't ask for this, ignore this email.`,
    buildResetEmailHtml(resetUrl, firstName)
  );
}
