import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { FadeIn } from "@/components/landing-page/fade-in"
import { Eyebrow, SectionTitle } from "@/components/landing-page/section-heading"

function RegisterIllustration() {
    const lines = [
        { name: "Ali R.", value: "3000 · 5/10", struck: true },
        { name: "Hamza", value: "??" },
        { name: "Usman B.", value: "8000", struck: true, valueStruck: true },
        { name: "Saad (new)", value: "paid?" },
        { name: "Bilal", value: "see last page" },
    ]
    return (
        <div className="w-full max-w-[280px] -rotate-2 rounded border border-[#E6E1C8] bg-[#FFFDF4] px-4 py-3 font-serif text-sm italic text-[#2B3A8C] shadow-md">
            {lines.map((line) => (
                <div key={line.name} className="flex justify-between border-b border-[#C9D3F0] py-1.5 last:border-b-0">
                    <span className={line.struck ? "line-through" : ""}>{line.name}</span>
                    <span className={line.valueStruck ? "line-through" : ""}>{line.value}</span>
                </div>
            ))}
        </div>
    )
}

function ChatIllustration() {
    return (
        <div className="flex w-full flex-col gap-2.5 text-sm">
            <div className="max-w-[80%] self-start rounded-[10px] rounded-bl-sm bg-surface px-3.5 py-2.5 shadow-sm">
                Bhai, I paid last month. Cash, remember?
            </div>
            <div className="max-w-[80%] self-end rounded-[10px] rounded-br-sm bg-[#DCF8C6] px-3.5 py-2.5 shadow-sm">
                Let me check the register...
            </div>
            <div className="self-start rounded-[10px] rounded-bl-sm bg-surface px-3.5 py-2.5 text-muted-foreground shadow-sm">
                typing…
            </div>
        </div>
    )
}

function LapsedIllustration() {
    return (
        <div className="flex w-full max-w-[280px] flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-md">
            <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-[13px] font-bold text-secondary-foreground">
                    BA
                </div>
                <div>
                    <div className="text-sm font-semibold">Bilal Ahmed</div>
                    <div className="text-xs text-muted-foreground">Monthly · PKR 3,000</div>
                </div>
            </div>
            <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Fee ran out</span>
                <span className="font-semibold text-red-700">23 days ago</span>
            </div>
            <div className="flex justify-between text-[13px]">
                <span className="text-muted-foreground">Reminder sent</span>
                <span className="font-semibold">Never</span>
            </div>
        </div>
    )
}

const problems = [
    {
        title: "The register is full of crossings-out",
        body: "Names, dates and amounts across a dozen pages — and the one you need is never on the page you open.",
        fix: "Kettlio: every member and fee in one list you can search.",
        Illustration: RegisterIllustration,
    },
    {
        title: "“Bhai, I paid last month”",
        body: "Without a record or a receipt it's your word against theirs — and most of the time you let it go.",
        fix: "Kettlio: every payment recorded, with a PDF receipt.",
        Illustration: ChatIllustration,
    },
    {
        title: "Members quietly stop coming",
        body: "Their fee ran out weeks ago and nobody noticed. That's money walking out the door every month.",
        fix: "Kettlio: you're told the day any fee runs out.",
        Illustration: LapsedIllustration,
    },
]

export function PainPoints() {
    return (
        <section id="problems" className="theme-light scroll-mt-16 bg-background text-foreground">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-6 py-24">
                <FadeIn className="flex flex-col items-center gap-3.5 text-center">
                    <Eyebrow>Sound familiar?</Eyebrow>
                    <SectionTitle className="max-w-[760px]">
                        Running a gym is hard. Knowing who paid shouldn&apos;t be.
                    </SectionTitle>
                </FadeIn>

                <div className="grid gap-5 md:grid-cols-3">
                    {problems.map(({ title, body, fix, Illustration }, index) => (
                        <FadeIn
                            key={title}
                            delay={0.1 + index * 0.1}
                            className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-surface"
                        >
                            <div aria-hidden="true" className="flex h-[200px] items-center justify-center bg-muted p-6">
                                <Illustration />
                            </div>
                            <div className="flex flex-1 flex-col gap-2.5 p-6">
                                <h3 className="text-xl font-bold">{title}</h3>
                                <p className="text-[15px] text-muted-foreground">{body}</p>
                                <div className="mt-auto flex items-start gap-2.5 border-t border-border pt-3.5 text-sm font-semibold text-secondary-foreground">
                                    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary">
                                        <Check className="size-3.5 text-primary-foreground" strokeWidth={3} aria-hidden="true" />
                                    </span>
                                    {fix}
                                </div>
                            </div>
                        </FadeIn>
                    ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-center">
                    <p className="text-[17px] font-semibold">Sound like your gym?</p>
                    <Link
                        href="#register"
                        className="inline-flex min-h-11 items-center gap-2 border-b-[3px] border-primary px-1 text-[17px] font-bold"
                    >
                        Register your gym <ArrowRight className="size-[18px]" aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </section>
    )
}
