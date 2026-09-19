import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/landing-page/fade-in"
import { ProductPreview } from "@/components/landing-page/product-preview"
import { contactHref } from "@/components/landing-page/contact"

export function Hero() {
    return (
        <section className="landing-section pb-12 pt-16 lg:pt-28">
            <div className="landing-container flex flex-col items-center gap-6 text-center">
                <FadeIn>
                    <p className="landing-eyebrow">Operations, finally in one place</p>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <h1 className="landing-display max-w-5xl">
                        Run the gym. Not the paperwork.
                    </h1>
                </FadeIn>
                <FadeIn delay={0.2}>
                    <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                        GymSaaS gives owners one clear workspace for members, subscriptions, locations, equipment, tasks, announcements, and payment records.
                    </p>
                </FadeIn>
                <FadeIn delay={0.3}>
                    <div className="space-x-4">
                        <Link href="/sign-in">
                            <Button size="lg" className="h-11 px-8">
                                Sign in to GymSaaS
                            </Button>
                        </Link>
                        <Link href={contactHref}>
                            <Button variant="outline" size="lg" className="h-11 px-8">
                                Request a demo
                            </Button>
                        </Link>
                    </div>
                </FadeIn>
            </div>
                        <FadeIn delay={0.4} className="mt-12 w-full">
                                <ProductPreview />
                        </FadeIn>

        </section>
    )
}
