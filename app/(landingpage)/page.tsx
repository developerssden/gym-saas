import { LandingHeader } from "@/components/landing-page/header"
import { Hero } from "@/components/landing-page/hero"
import { Features } from "@/components/landing-page/features"
import { HowItWorks } from "@/components/landing-page/testimonials"
import { Pricing } from "@/components/landing-page/pricing"
import { CTA } from "@/components/landing-page/cta"
import { Footer } from "@/components/landing-page/footer"
import { FAQ } from "@/components/landing-page/faq"
import { contactEmail } from "@/components/landing-page/contact"

export const metadata = {
  title: "Gym management without the busywork",
  description: "Manage members, subscriptions, locations, equipment, tasks, and payment records in one gym owner workspace.",
  alternates: { canonical: "/" },
  openGraph: { title: "GymSaaS | Gym management without the busywork", description: "A practical workspace for gym owners." },
  twitter: { card: "summary_large_image" as const, title: "GymSaaS | Gym management without the busywork", description: "A practical workspace for gym owners." },
}

export default function Home() {
  return (
    <div className="landing-grid flex min-h-screen flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2">Skip to content</a>
      <LandingHeader />
      <main id="main-content" className="flex-1">
        <section id="hero">
          <Hero />
        </section>
        <section id="features">
          <Features />
        </section>
        <HowItWorks />
        <section id="pricing">
          <Pricing />
        </section>
        <FAQ />
        <section id="cta">
          <CTA />
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "GymSaaS", applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "Gym management workspace for members, subscriptions, locations, equipment, tasks, and payment records.", offers: { "@type": "Offer", url: "/pricing" }, contactPoint: { "@type": "ContactPoint", email: contactEmail } }) }} />
    </div>
  )
}
