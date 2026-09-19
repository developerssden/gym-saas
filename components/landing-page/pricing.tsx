"use client"

import { Check } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/landing-page/fade-in"
import { BillingToggle, getCheckoutUrl, getPlanFeatures, getPlanPrice, usePublicPlans } from "@/components/pricing/shared"
import { contactHref } from "@/components/landing-page/contact"

export function Pricing({ standalone = false }: { standalone?: boolean }) {
  const { plans, loading, error } = usePublicPlans()
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly")
  const wrapper = standalone ? "landing-container py-20" : "landing-section landing-container"

  return <section className={wrapper}>
    <div className="mx-auto max-w-2xl text-center">
      <p className="landing-eyebrow">Plans that stay legible</p>
      {standalone ? <h1 className="landing-heading mt-3">Choose the shape of your operation.</h1> : <h2 className="landing-heading mt-3">Choose the shape of your operation.</h2>}
      <p className="mt-5 text-muted-foreground">Live plan data from GymSaaS. Limits are shown exactly as configured for each plan.</p>
      <BillingToggle billing={billing} onChange={setBilling} className="mt-7" />
    </div>
    {loading && <p className="mt-12 text-center text-muted-foreground">Loading plans...</p>}
    {error && <p className="mt-12 text-center text-destructive">Plans are temporarily unavailable. Please contact us.</p>}
    {!loading && !error && plans.length === 0 && <p className="mt-12 text-center text-muted-foreground">No plans are available right now.</p>}
    {!loading && !error && plans.length > 0 && <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan, index) => {
        const checkoutUrl = getCheckoutUrl(plan, billing)
        return <FadeIn key={plan.id} delay={index * 0.08} className="h-full">
          <article className={`flex h-full flex-col rounded-2xl border bg-card p-6 ${index === 1 ? "border-primary shadow-lg" : ""}`}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Plan</p><h3 className="mt-1 text-2xl font-bold">{plan.name}</h3></div>{index === 1 && <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Popular</span>}</div>
            <p className="mt-6 text-4xl font-bold">{getPlanPrice(plan, billing).toLocaleString()}<span className="ml-2 text-sm font-normal text-muted-foreground">per {billing === "monthly" ? "month" : "year"}</span></p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground">{getPlanFeatures(plan).map((feature) => <li key={feature} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul>
            {checkoutUrl ? <a href={checkoutUrl} className="mt-8"><Button className="w-full">Continue to checkout</Button></a> : <a href={contactHref} className="mt-8"><Button variant="outline" className="w-full">Contact us about this plan</Button></a>}
          </article>
        </FadeIn>
      })}
    </div>}
    <p className="mt-10 text-center text-sm text-muted-foreground">Questions about a plan? <a className="underline underline-offset-4" href={contactHref}>Contact the team</a>.</p>
  </section>
}
