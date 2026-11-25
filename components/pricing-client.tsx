"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { SUPPORT_EMAIL } from "@/constants/brand";
import { WhatsAppIcon } from "@/components/common/whatsapp-icon";
import {
  CUSTOM_PRICING_LABEL,
  customPlanEmailUrl,
  customPlanWhatsAppUrl,
} from "@/lib/plan-pricing";
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
            const isCustom = plan.is_custom_pricing;
            const isPopular = index === 1 && plans.length >= 2 && !isCustom;

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
                  {isCustom ? (
                    <div className="mt-3 space-y-1">
                      <span className="block text-4xl font-bold">
                        {CUSTOM_PRICING_LABEL}
                      </span>
                      <span className="block text-muted-foreground text-sm">
                        Priced for your gym&apos;s size. Tell us what you need.
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        PKR {price.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        /{billing === "monthly" ? "mo" : "yr"}
                      </span>
                    </div>
                  )}
                </div>

                <ul className="space-y-2.5 text-sm flex-1">
                  {features.map((feature) => (
                    <PricingFeature key={feature} label={feature} />
                  ))}
                </ul>

                {isCustom ? (
                  <div className="flex flex-col gap-2">
                    <a
                      href={customPlanWhatsAppUrl(plan.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <WhatsAppIcon className="size-4 text-current dark:text-current" />
                      WhatsApp us
                    </a>
                    <a
                      href={customPlanEmailUrl(plan.name)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                    >
                      <Mail className="size-4" />
                      Email us
                    </a>
                  </div>
                ) : checkoutUrl ? (
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
          href={`mailto:${SUPPORT_EMAIL}`}
          className="underline underline-offset-4"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
