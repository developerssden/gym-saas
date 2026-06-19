"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FadeIn } from "@/components/landing-page/fade-in";
import {
  BillingToggle,
  getCheckoutUrl,
  getPlanFeatures,
  getPlanPrice,
  usePublicPlans,
} from "@/components/pricing/shared";
import { useState } from "react";

export function Pricing() {
  const { plans, loading } = usePublicPlans();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const gridCols =
    plans.length <= 1
      ? "md:grid-cols-1 max-w-md mx-auto"
      : plans.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="container space-y-6 bg-slate-50 py-8 dark:bg-transparent md:py-12 lg:py-24 mx-auto px-4">
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <FadeIn>
          <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
            Simple, transparent pricing
          </h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Choose the plan that&apos;s right for your gym. No hidden fees.
          </p>
        </FadeIn>
        <FadeIn delay={0.15}>
          <BillingToggle billing={billing} onChange={setBilling} />
        </FadeIn>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">Loading plans…</p>
      ) : plans.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No plans available right now.
        </p>
      ) : (
        <div
          className={`grid w-full items-start gap-6 rounded-lg border p-6 md:p-10 ${gridCols}`}
        >
          {plans.map((plan, index) => {
            const price = getPlanPrice(plan, billing);
            const checkoutUrl = getCheckoutUrl(plan, billing);
            const features = getPlanFeatures(plan);
            const isPopular = index === 1 && plans.length >= 2;

            return (
              <FadeIn
                key={plan.id}
                delay={0.2 + index * 0.1}
                className="grid gap-6"
              >
                <Card
                  className={`transition-all hover:scale-105 hover:shadow-lg ${
                    isPopular ? "border-primary shadow-md" : ""
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>
                      {isPopular
                        ? "Most popular for growing gyms."
                        : "Everything you need to manage your gym."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="text-4xl font-bold">
                      PKR {price.toLocaleString()}
                      <span className="text-lg font-normal text-muted-foreground">
                        /{billing === "monthly" ? "month" : "year"}
                      </span>
                    </div>
                    <ul className="grid gap-2 text-sm text-muted-foreground">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {checkoutUrl ? (
                      <a href={checkoutUrl} className="w-full">
                        <Button className="w-full">Get Started</Button>
                      </a>
                    ) : (
                      <Button className="w-full" disabled>
                        Coming soon
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      )}
    </section>
  );
}
