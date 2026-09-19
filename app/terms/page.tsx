import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms | GymSaaS",
  description: "Terms for using the GymSaaS gym management workspace.",
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  return <main id="main-content" className="mx-auto max-w-3xl px-6 py-20"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">GymSaaS terms</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Terms of service</h1><p className="mt-4 text-muted-foreground">This draft describes the intended use of the current application and requires owner and legal review before launch.</p><div className="prose prose-neutral mt-12 max-w-none dark:prose-invert"><h2>Using GymSaaS</h2><p>GymSaaS is a workspace for authorized gym owners and team members to manage gym information, locations, members, subscriptions, equipment, tasks, announcements, and payment records.</p><h2>Accounts and access</h2><p>Accounts are provided through the current sign-in and invitation flow. You are responsible for keeping access credentials private and for ensuring that people invited to your workspace are authorized to use the data they can access.</p><h2>Subscriptions and billing</h2><p>Plan availability, limits, and billing intervals are shown using the active plan configuration. Owner plan checkout and subscription processing are handled through Polar. Your use of paid features is subject to the applicable plan and payment terms.</p><h2>Acceptable use</h2><p>Do not misuse the service, attempt to access another organization&apos;s data, interfere with the application, or upload information you do not have permission to process.</p><h2>Service changes</h2><p>Features, limits, and availability may change as the product develops. The final service agreement should identify the owner, governing law, support commitments, and account termination process.</p><h2>Contact</h2><p>Questions about these terms can be sent to the contact address listed on the public site.</p></div></main>
}
