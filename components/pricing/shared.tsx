"use client";

import { useEffect, useState } from "react";

export type PublicPlan = {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  max_gyms: number;
  max_locations: number;
  max_members: number;
  max_equipment: number;
  polar_product_id: string | null;
  polar_checkout_url_monthly: string | null;
  polar_checkout_url_yearly: string | null;
};

export type BillingPeriod = "monthly" | "yearly";

export function usePublicPlans() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plans/getpublicplans")
      .then((r) => r.json())
      .then((data) => setPlans(data.plans ?? []))
      .finally(() => setLoading(false));
  }, []);

  return { plans, loading };
}

export function getPlanPrice(plan: PublicPlan, billing: BillingPeriod) {
  return billing === "monthly" ? plan.monthly_price : plan.yearly_price;
}

export function getCheckoutUrl(plan: PublicPlan, billing: BillingPeriod) {
  return billing === "monthly"
    ? plan.polar_checkout_url_monthly
    : plan.polar_checkout_url_yearly;
}

export function getPlanFeatures(plan: PublicPlan): string[] {
  return [
    `Up to ${plan.max_gyms} gym${plan.max_gyms > 1 ? "s" : ""}`,
    `Up to ${plan.max_locations} location${plan.max_locations > 1 ? "s" : ""}`,
    `${plan.max_members} members per location`,
    `${plan.max_equipment} equipment items per location`,
    "Automated expiry reminders",
    "PDF invoices",
    "Member payment tracking",
  ];
}

type BillingToggleProps = {
  billing: BillingPeriod;
  onChange: (billing: BillingPeriod) => void;
  className?: string;
};

export function BillingToggle({
  billing,
  onChange,
  className = "",
}: BillingToggleProps) {
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-full border p-1 ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          billing === "monthly"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          billing === "yearly"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Yearly
        <span className="ml-1.5 text-xs text-green-600 font-semibold">
          Save ~17%
        </span>
      </button>
    </div>
  );
}
