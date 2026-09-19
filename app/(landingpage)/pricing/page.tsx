import { Suspense } from "react";
import PricingClient from "@/components/pricing-client";

export const metadata = {
  title: "Pricing | GymSaaS",
  description: "Compare GymSaaS plans and the operational limits configured for each one.",
  alternates: { canonical: "/pricing" },
  openGraph: { title: "Pricing | GymSaaS", description: "Compare GymSaaS plans." },
  twitter: { card: "summary_large_image" as const, title: "Pricing | GymSaaS", description: "Compare GymSaaS plans." },
};

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading plans…
        </div>
      }
    >
      <PricingClient />
    </Suspense>
  );
}
