import { escapeHtml } from "@/lib/email/escape-html";

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function getOwnerReminderEmail(
  ownerName: string,
  daysLeft: number,
  planName: string
): EmailContent {
  const subject =
    daysLeft === 0
      ? "Your Gym Subscription Has Expired"
      : `Your Gym Subscription Expires in ${daysLeft} Day${daysLeft > 1 ? "s" : ""}`;
  const text =
    daysLeft === 0
      ? `Dear ${ownerName},\n\nYour subscription to ${planName} has expired. Please renew your subscription to continue using our services.\n\nThank you.`
      : `Dear ${ownerName},\n\nThis is a reminder that your subscription to ${planName} will expire in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.\n\nPlease renew your subscription to avoid any interruption in service.\n\nThank you.`;
  const safeOwnerName = escapeHtml(ownerName);
  const safePlanName = escapeHtml(planName);
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p>Dear ${safeOwnerName},</p>
      ${
        daysLeft === 0
          ? `<p>Your subscription to <strong>${safePlanName}</strong> has expired. Please renew your subscription to continue using our services.</p>`
          : `<p>This is a reminder that your subscription to <strong>${safePlanName}</strong> will expire in <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong>.</p>
             <p>Please renew your subscription to avoid any interruption in service.</p>`
      }
      <p>Thank you.</p>
    </div>
  `;

  return { subject, text, html };
}

export function getMemberReminderEmail(
  memberName: string,
  daysLeft: number
): EmailContent {
  const subject =
    daysLeft === 0
      ? "Your Gym Membership Has Expired"
      : `Your Gym Membership Expires in ${daysLeft} Day${daysLeft > 1 ? "s" : ""}`;
  const text =
    daysLeft === 0
      ? `Dear ${memberName},\n\nYour gym membership has expired. Please renew your membership to continue accessing the gym.\n\nThank you.`
      : `Dear ${memberName},\n\nThis is a reminder that your gym membership will expire in ${daysLeft} day${daysLeft > 1 ? "s" : ""}.\n\nPlease renew your membership to avoid any interruption in service.\n\nThank you.`;
  const safeMemberName = escapeHtml(memberName);
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p>Dear ${safeMemberName},</p>
      ${
        daysLeft === 0
          ? `<p>Your gym membership has expired. Please renew your membership to continue accessing the gym.</p>`
          : `<p>This is a reminder that your gym membership will expire in <strong>${daysLeft} day${daysLeft > 1 ? "s" : ""}</strong>.</p>
             <p>Please renew your membership to avoid any interruption in service.</p>`
      }
      <p>Thank you.</p>
    </div>
  `;

  return { subject, text, html };
}

export function getSuperAdminSummaryEmail(
  expiredOwners: Array<{ name: string; email: string; planName: string }>
): EmailContent {
  const subject = `Daily Subscription Expiration Report - ${expiredOwners.length} Owner${expiredOwners.length !== 1 ? "s" : ""} Expired`;
  const text = `Daily Subscription Expiration Report\n\n${expiredOwners.length} owner subscription${expiredOwners.length !== 1 ? "s have" : " has"} expired today:\n\n${expiredOwners
    .map(
      (owner) =>
        `- ${owner.name} (${owner.email}) - Plan: ${owner.planName}`
    )
    .join("\n")}\n\nPlease follow up with these owners to renew their subscriptions.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p><strong>${expiredOwners.length}</strong> owner subscription${expiredOwners.length !== 1 ? "s have" : " has"} expired today:</p>
      <ul>
        ${expiredOwners
          .map(
            (owner) =>
              `<li><strong>${escapeHtml(owner.name)}</strong> (${escapeHtml(owner.email)}) - Plan: ${escapeHtml(owner.planName)}</li>`
          )
          .join("")}
      </ul>
      <p>Please follow up with these owners to renew their subscriptions.</p>
    </div>
  `;

  return { subject, text, html };
}

export type GymOwnerExpiredMember = {
  name: string;
  email: string;
  phone_number?: string | null;
  address?: string | null;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
};

function formatDigestDate(value?: Date | string | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMemberDigestLine(member: GymOwnerExpiredMember): string {
  const email = member.email?.trim() || "No email";
  const phone = member.phone_number?.trim() || "No phone";
  const address = member.address?.trim() || "—";
  const start = formatDigestDate(member.start_date);
  const end = formatDigestDate(member.end_date);
  return `${member.name} | Email: ${email} | Phone: ${phone} | Address: ${address} | Start: ${start} | End: ${end}`;
}

export function getGymOwnerSummaryEmail(
  expiredMembers: Array<GymOwnerExpiredMember>
): EmailContent {
  const subject = `Daily Membership Expiration Report - ${expiredMembers.length} Member${expiredMembers.length !== 1 ? "s" : ""} Expired`;
  const text = `Daily Membership Expiration Report\n\n${expiredMembers.length} member subscription${expiredMembers.length !== 1 ? "s have" : " has"} expired today:\n\n${expiredMembers
    .map((member) => `- ${formatMemberDigestLine(member)}`)
    .join("\n")}\n\nPlease follow up with these members to renew their memberships.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${subject}</h2>
      <p><strong>${expiredMembers.length}</strong> member subscription${expiredMembers.length !== 1 ? "s have" : " has"} expired today:</p>
      <ul>
        ${expiredMembers
          .map((member) => {
            const email = member.email?.trim() || "No email";
            const phone = member.phone_number?.trim() || "No phone";
            const address = member.address?.trim() || "—";
            const start = formatDigestDate(member.start_date);
            const end = formatDigestDate(member.end_date);
            return `<li>
              <strong>${escapeHtml(member.name)}</strong><br/>
              Email: ${escapeHtml(email)}<br/>
              Phone: ${escapeHtml(phone)}<br/>
              Address: ${escapeHtml(address)}<br/>
              Start: ${escapeHtml(start)} | End: ${escapeHtml(end)}
            </li>`;
          })
          .join("")}
      </ul>
      <p>Please follow up with these members to renew their memberships.</p>
    </div>
  `;

  return { subject, text, html };
}
