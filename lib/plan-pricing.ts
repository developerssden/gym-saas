import { APP_NAME, SUPPORT_EMAIL } from "@/constants/brand";
import { CONTACT } from "@/constants/landing";

// Plans with custom pricing (e.g. Pro) show no fixed price or checkout. Owners
// talk to us on WhatsApp or email first, and a super admin assigns the plan
// with the limits and price agreed for that gym.

export const CUSTOM_PRICING_LABEL = "Custom pricing";

/** Shown on the pricing card in place of the plan's numeric limits. */
export const CUSTOM_PLAN_FEATURES = [
  "As many gyms and branches as you need",
  "Member, equipment and staff limits set for your gym",
  "Automated expiry reminders",
  "PDF invoices",
  "Member payment tracking",
] as const;

function enquiry(planName: string) {
  return `Hi, I'm interested in the ${APP_NAME} ${planName} plan for my gym.`;
}

/** wa.me link with a ready-made message about the plan. */
export function customPlanWhatsAppUrl(planName: string, whatsappNumber: string = CONTACT.whatsappNumber) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(enquiry(planName))}`;
}

/** mailto link with the plan in the subject and a starter message. */
export function customPlanEmailUrl(planName: string, email: string = SUPPORT_EMAIL) {
  const subject = encodeURIComponent(`${APP_NAME} ${planName} plan`);
  const body = encodeURIComponent(
    `${enquiry(planName)}\n\nGym name:\nNumber of branches:\nAbout how many members:\n`
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
