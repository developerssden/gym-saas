import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/landing-page/fade-in"
import Image from "next/image"

export function Hero() {
    return (
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
            <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center mx-auto px-4">
                <FadeIn>
                    <Link
                        href="https://www.linkedin.com/in/its-bakar/"
                        className="rounded-2xl bg-muted px-4 py-1.5 text-sm font-medium"
                        target="_blank"
                    >
                        Follow along on LinkedIn
                    </Link>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <h1 className="font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                        Manage Your Gym Like a Pro
                    </h1>
                </FadeIn>
                <FadeIn delay={0.2}>
                    <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                        All-in-one solution for gym owners. Dashboard, Members, Inventory, Finance, and more.
                        Streamline your operations and focus on growing your community.
                    </p>
                </FadeIn>
                <FadeIn delay={0.3}>
                    <div className="space-x-4">
                        <Link href="/signup">
                            <Button size="lg" className="h-11 px-8">
                                Get Started Free
                            </Button>
                        </Link>
                        <Link href="#features">
                            <Button variant="outline" size="lg" className="h-11 px-8">
                                View Demo
                            </Button>
                        </Link>
                    </div>
                </FadeIn>
            </div>
            <FadeIn delay={0.4} className="mx-auto mt-16 max-w-5xl px-4 sm:px-6 lg:px-8">
  <div className="rounded-xl border bg-background p-2 shadow-2xl ring-1 ring-gray-900/10 dark:ring-gray-100/10">
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-gradient-to-tr from-sky-200 to-blue-300 dark:from-sky-900 dark:to-blue-900">
      <Image
        src="/dashboard.png"
        alt="Dashboard preview"
        fill
        className="object-cover"
        priority
        sizes="(max-width: 768px) 100vw, 900px"
      />
    </div>
  </div>
</FadeIn>

        </section>
    )
}
