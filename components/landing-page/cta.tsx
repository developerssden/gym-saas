import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/landing-page/fade-in"

export function CTA() {
    return (
        <section className="border-t">
            <div className="container flex flex-col items-center gap-4 py-24 text-center md:py-32 mx-auto px-4">
                <FadeIn>
                    <h2 className="font-heading text-3xl font-bold leading-[1.1] sm:text-3xl md:text-6xl">
                        Ready to take your gym to the next level?
                    </h2>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                        Join thousands of gym owners who trust GymSaaS to manage their business.
                        Start your free 14-day trial today.
                    </p>
                </FadeIn>
                <FadeIn delay={0.2}>
                    <Link href="/signup">
                        <Button size="lg" className="h-11 px-8">
                            Start Free Trial
                        </Button>
                    </Link>
                </FadeIn>
            </div>
        </section>
    )
}
