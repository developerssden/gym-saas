import prisma from "@/lib/prisma";
import sendEmail from "@/lib/sendEmail";
import { escapeHtml } from "@/lib/email/escape-html";
import { createInAppNotification } from "@/lib/notifications/create-notification";
import { sendPushToUser } from "@/lib/push/send-push";
import type { GymRegistration } from "@/prisma/generated/client";

/**
 * Tells every Super Admin about a new landing-page registration (in-app notice,
 * device push and one email). Never throws: a failed notification must not fail
 * the registration itself.
 */
export async function notifyNewRegistration(registration: GymRegistration): Promise<void> {
  const title = "New gym registration";
  const body = `${registration.gym_name} (${registration.city}) — ${registration.owner_name}, ${registration.phone}`;
  const url = "/registrations";

  const tasks: Promise<unknown>[] = [];

  try {
    const admins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", is_deleted: false, is_active: true },
      select: { id: true },
    });
    for (const admin of admins) {
      tasks.push(createInAppNotification(admin.id, { title, body, url, type: "gym_registration" }));
      tasks.push(sendPushToUser(admin.id, { title, body, url }));
    }
  } catch (err: unknown) {
    console.error("[registrations] failed to load super admins", {
      message: err instanceof Error ? err.message : err,
    });
  }

  const to = process.env.REGISTRATION_NOTIFY_EMAIL || process.env.GMAIL_USER;
  if (to) {
    const { subject, text, html } = buildRegistrationEmail(registration);
    tasks.push(sendEmail(to, subject, text, html));
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[registrations] notification failed", {
        message: result.reason instanceof Error ? result.reason.message : result.reason,
      });
    }
  }
}

function buildRegistrationEmail(registration: GymRegistration) {
  const rows: [string, string][] = [
    ["Owner", registration.owner_name],
    ["Gym", registration.gym_name],
    ["Phone / WhatsApp", registration.phone],
    ["City", registration.city],
    ["Members", registration.member_count || "—"],
    ["Message", registration.message || "—"],
  ];

  const subject = `New gym registration: ${registration.gym_name} (${registration.city})`;
  const text = `A gym owner registered on the Kettlio landing page.\n\n${rows
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n")}\n\nWhatsApp: https://wa.me/${registration.phone.replace(/\D/g, "")}`;
  const html = `
    <p>A gym owner registered on the Kettlio landing page.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="font-weight:bold;vertical-align:top">${escapeHtml(label)}</td><td style="white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
        )
        .join("")}
    </table>
    <p><a href="https://wa.me/${registration.phone.replace(/\D/g, "")}">Message them on WhatsApp</a></p>
  `;

  return { subject, text, html };
}
