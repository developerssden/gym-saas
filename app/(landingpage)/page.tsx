import { LandingHeader } from "@/components/landing-page/header"
import { Hero } from "@/components/landing-page/hero"
import { Features } from "@/components/landing-page/features"
import { Testimonials } from "@/components/landing-page/testimonials"
import { Pricing } from "@/components/landing-page/pricing"
import { CTA } from "@/components/landing-page/cta"
import { Footer } from "@/components/landing-page/footer"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <Testimonials />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
