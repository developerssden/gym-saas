import { Suspense } from "react";
import PricingClient from "@/components/pricing-client";

export const metadata = {
  title: "Pricing | Gym SaaS",
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
