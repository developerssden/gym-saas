import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy | GymSaaS",
  description: "How GymSaaS handles account, gym, member, notification, and payment data.",
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return <main id="main-content" className="mx-auto max-w-3xl px-6 py-20"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">GymSaaS privacy</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Privacy policy</h1><p className="mt-4 text-muted-foreground">This draft explains the data practices reflected in the current product. It should be reviewed and completed by the owner before launch.</p><div className="prose prose-neutral mt-12 max-w-none dark:prose-invert"><h2>Data we handle</h2><p>GymSaaS stores account and gym-operations data needed to provide the service, including names, email addresses, phone numbers, addresses, gym and location details, memberships, subscriptions, equipment, tasks, announcements, and payment records.</p><h2>Notifications</h2><p>The service may send account and subscription expiry reminders by email, and may deliver push notifications when a user has enabled them on a supported device. In-app notifications may also be stored for delivery inside the dashboard.</p><h2>Payments</h2><p>Owner plan checkout and subscription events are handled through Polar. GymSaaS records the subscription and payment information needed to operate the account; payment processing details are handled according to Polar&apos;s terms and privacy policy.</p><h2>Access and retention</h2><p>Access to operational data is controlled through authenticated sessions and application roles. Data is retained while it is needed to provide the service or meet an owner&apos;s operational needs, subject to the final retention policy.</p><h2>Your choices</h2><p>For questions about data access, correction, deletion, or notifications, contact the service owner through the contact address on the landing page.</p></div></main>
}
