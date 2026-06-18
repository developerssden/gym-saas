import sendEmail from "@/lib/sendEmail";

export function getInviteBaseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "").replace(
    /\/api\/auth\/?$/,
    ""
  );
}

export function buildInviteUrl(email: string, rawToken: string): string {
  const baseUrl = getInviteBaseUrl();
  return `${baseUrl}/onboarding?email=${encodeURIComponent(email)}&token=${rawToken}`;
}

export function buildInviteEmailHtml(inviteUrl: string, isResend = false): string {
  const heading = isResend
    ? "Your invite link has been renewed"
    : "You're invited to Gym SaaS";
  const intro = isResend
    ? "Your previous invite link expired. Use the button below to complete your profile and set your password."
    : "You've been added as a gym owner. Click the button below to complete your profile and set your password.";

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1a1a1a;">${heading}</h2>
      <p style="color: #444;">${intro}</p>
      <a href="${inviteUrl}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#e07b39;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        Complete My Profile
      </a>
      <p style="margin-top:24px;color:#888;font-size:13px;">This link expires in 48 hours. If you did not expect this invitation, you can ignore this email.</p>
    </div>
  `;
}

export async function sendInviteEmail(
  email: string,
  inviteUrl: string,
  isResend = false
): Promise<void> {
  const subject = isResend
    ? "Your Gym SaaS invite link has been renewed"
    : "You've been invited to Gym SaaS";
  const text = isResend
    ? `Your invite link has been renewed. Complete your profile here: ${inviteUrl}`
    : `You've been invited to set up your gym management account. Complete your profile here: ${inviteUrl}`;

  await sendEmail(email, subject, text, buildInviteEmailHtml(inviteUrl, isResend));
}
