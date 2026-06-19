"use client";

import { useState } from "react";
import {
  BillingToggle,
  getCheckoutUrl,
  getPlanFeatures,
  getPlanPrice,
  usePublicPlans,
} from "@/components/pricing/shared";

function PricingFeature({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <svg
        className="h-4 w-4 text-green-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      <span>{label}</span>
    </li>
  );
}

export default function PricingClient() {
  const { plans, loading } = usePublicPlans();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading plans…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-12 text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground text-lg">
          Everything your gym needs — member tracking, reminders, payments, and
          more.
        </p>

        <BillingToggle
          billing={billing}
          onChange={setBilling}
          className="mt-6"
        />
      </div>

      {plans.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No plans available right now.
        </p>
      ) : (
        <div
          className={`grid gap-6 ${
            plans.length === 1
              ? "max-w-sm mx-auto"
              : plans.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {plans.map((plan, index) => {
            const price = getPlanPrice(plan, billing);
            const checkoutUrl = getCheckoutUrl(plan, billing);
            const features = getPlanFeatures(plan);
            const isPopular = index === 1 && plans.length >= 2;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-8 flex flex-col gap-6 ${
                  isPopular ? "border-primary shadow-lg" : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      PKR {price.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      /{billing === "monthly" ? "mo" : "yr"}
                    </span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-sm flex-1">
                  {features.map((feature) => (
                    <PricingFeature key={feature} label={feature} />
                  ))}
                </ul>

                {checkoutUrl ? (
                  <a
                    href={checkoutUrl}
                    className={`w-full text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                      isPopular
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border hover:bg-muted"
                    }`}
                  >
                    Get started
                  </a>
                ) : (
                  <button
                    disabled
                    className="w-full text-center rounded-lg px-4 py-2.5 text-sm font-semibold border opacity-50 cursor-not-allowed"
                  >
                    Coming soon
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-12 text-center text-sm text-muted-foreground">
        All plans include a 14-day free trial. No credit card required to start.
        <br />
        Questions? Contact us at{" "}
        <a
          href="mailto:hello@yourdomain.com"
          className="underline underline-offset-4"
        >
          hello@yourdomain.com
        </a>
      </p>
    </div>
  );
}
