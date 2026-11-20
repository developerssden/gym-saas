import Link from "next/link"
import { ArrowRight, Bell, Check, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/landing-page/fade-in"
import { Eyebrow, SectionTitle } from "@/components/landing-page/section-heading"

function FormVisual() {
    return (
        <div className="flex w-full max-w-[280px] flex-col gap-2.5 rounded-lg border border-border bg-background p-4">
            {[
                ["Gym name", "Iron Zone Gym"],
                ["City", "Gujrat"],
            ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                    <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
                    <div className="rounded-md border border-input px-2.5 py-1.5 text-[13px]">{value}</div>
                </div>
            ))}
            <div className="rounded-md bg-primary py-2 text-center text-[13px] font-bold text-primary-foreground">
                Register your gym
            </div>
        </div>
    )
}

function ImportVisual() {
    return (
        <div className="flex w-full max-w-[280px] flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3.5 py-3">
                <div className="flex h-10 w-[34px] items-end justify-center rounded bg-green-800 pb-1.5 text-[10px] font-extrabold text-white">
                    XLS
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">members.xlsx</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full w-full bg-primary" />
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-accent bg-secondary px-3.5 py-3 text-[13px] font-semibold text-secondary-foreground">
                <Check className="size-4 text-primary" strokeWidth={2.6} />
                184 members imported
            </div>
        </div>
    )
}

function CollectVisual() {
    return (
        <div className="flex w-full max-w-[280px] flex-col gap-2.5">
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3.5 py-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary">
                    <Bell className="size-[15px] text-primary-foreground" />
                </div>
                <div className="text-[13px]">
                    <div className="font-bold">Ali Raza&apos;s fee ran out today</div>
                    <div className="text-muted-foreground">Monthly · PKR 3,000</div>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2.5 rounded-lg border border-border bg-background px-3.5 py-3 text-[13px]">
                <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="font-semibold">Receipt #0142.pdf</span>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">Paid</span>
            </div>
        </div>
    )
}

const steps = [
    {
        title: "Register your gym",
        body: "Fill a short form. We call you, set up your account and walk you through it — free.",
        Visual: FormVisual,
    },
    {
        title: "Add your members",
        body: "Upload your Excel sheet and everyone's in at once — or we move your paper register in for you.",
        Visual: ImportVisual,
    },
    {
        title: "Get reminded, collect, done",
        body: "Kettlio tells you the day a fee runs out. Record the payment and hand over a PDF receipt in seconds.",
        Visual: CollectVisual,
    },
]

export function HowItWorks() {
    return (
        <section id="how" className="dark scroll-mt-16 bg-background text-foreground">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-14 px-6 py-24 md:py-28">
                <FadeIn className="flex flex-wrap items-end justify-between gap-6">
                    <div className="flex max-w-[640px] flex-col gap-3.5">
                        <Eyebrow>How it works</Eyebrow>
                        <SectionTitle>From register to Kettlio in three steps</SectionTitle>
                    </div>
                    <p className="max-w-[380px] text-[17px] text-muted-foreground">
                        No training, no laptop needed. We set it up with you in one visit or call.
                    </p>
                </FadeIn>

                <ol className="grid gap-5 md:grid-cols-3">
                    {steps.map(({ title, body, Visual }, index) => (
                        <li key={title} className="h-full">
                            <FadeIn delay={0.1 + index * 0.1} className="flex h-full flex-col overflow-hidden rounded-[10px] border border-border bg-card">
                                <div aria-hidden="true" className="flex h-[220px] items-center justify-center border-b border-border p-6">
                                    <Visual />
                                </div>
                                <div className="flex flex-col gap-2.5 p-6">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-[30px] items-center justify-center rounded-full bg-primary font-heading text-[15px] font-black text-primary-foreground">
                                            {index + 1}
                                        </span>
                                        <h3 className="text-xl font-bold">{title}</h3>
                                    </div>
                                    <p className="text-[15px] text-muted-foreground">{body}</p>
                                </div>
                            </FadeIn>
                        </li>
                    ))}
                </ol>

                <div className="flex justify-center">
                    <Button asChild className="h-14 px-6 text-[17px] font-bold">
                        <Link href="#register">
                            Start with step 1 — register your gym <ArrowRight className="size-[18px]" aria-hidden="true" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    )
}
