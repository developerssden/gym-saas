import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing-page/header"
import { Hero } from "@/components/landing-page/hero"
import { PainPoints } from "@/components/landing-page/pain-points"
import { HowItWorks } from "@/components/landing-page/how-it-works"
import { Features } from "@/components/landing-page/features"
import { FAQ } from "@/components/landing-page/faq"
import { RegisterForm } from "@/components/landing-page/register-form"
import { Footer } from "@/components/landing-page/footer"

export const metadata: Metadata = {
  title: { absolute: "Kettlio — Gym management made easy" },
  description:
    "Kettlio keeps every member's fee in one place, reminds you before memberships run out and gives PDF receipts. Made for gyms in Pakistan.",
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <PainPoints />
        <HowItWorks />
        <Features />
        <FAQ />
        <RegisterForm />
      </main>
      <Footer />
    </div>
  )
}
