import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/landing-page/fade-in"
import { contactHref } from "@/components/landing-page/contact"

export function CTA() {
    return (
        <section className="landing-section border-t">
            <div className="landing-container flex flex-col items-center gap-5 text-center">
                <FadeIn>
                    <h2 className="font-heading text-3xl font-bold leading-[1.1] sm:text-3xl md:text-6xl">
                        Your next clear decision is one click away.
                    </h2>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                        Sign in with your existing GymSaaS access, or contact the team to talk through your setup.
                    </p>
                </FadeIn>
                <FadeIn delay={0.2}>
                    <div className="flex flex-wrap justify-center gap-3">
                    <Link href="/sign-in">
                        <Button size="lg" className="h-11 px-8">
                            Sign in to GymSaaS
                        </Button>
                    </Link>
                    <a href={contactHref} className="inline-flex h-11 items-center rounded-md border px-8 text-sm font-medium transition-colors hover:bg-muted">Request a demo</a>
                    </div>
                </FadeIn>
            </div>
        </section>
    )
}
