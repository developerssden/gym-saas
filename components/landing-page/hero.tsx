import Link from "next/link"
import { ArrowRight, Check, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/landing-page/fade-in"
import { WhatsAppIcon } from "@/components/landing-page/whatsapp-icon"
import { WHATSAPP_URL } from "@/constants/landing"

const reassurance = ["Free setup", "Import members from Excel", "Works on any phone"]

const sidebarItems = ["Dashboard", "Members", "Member subscriptions", "Payments", "Equipment", "To-dos"]

const stats = [
    { label: "Active members", value: "184", className: "" },
    { label: "Collected", value: "PKR 4.1L", className: "text-primary" },
    { label: "Due this week", value: "12", className: "text-amber-300" },
    { label: "Expired", value: "7", className: "text-red-300" },
]

const rows = [
    { name: "Ali Raza", plan: "Monthly", amount: "PKR 3,000", status: "Due in 2 days", tone: "due" },
    { name: "Hamza Khan", plan: "Monthly", amount: "PKR 3,000", status: "Expired", tone: "expired" },
    { name: "Usman Butt", plan: "3 months", amount: "PKR 8,000", status: "Paid", tone: "paid" },
] as const

const toneClass = {
    due: "bg-amber-950 text-amber-300",
    expired: "bg-red-950 text-red-300",
    paid: "bg-secondary text-primary",
}

export function Hero() {
    return (
        <section id="top" className="dark overflow-hidden bg-background text-foreground">
            <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-6 pt-16 text-center md:pt-20">
                <FadeIn>
                    <span className="inline-flex items-center gap-2 rounded-full border border-accent bg-secondary px-3.5 py-1.5 text-sm font-semibold text-secondary-foreground">
                        <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                        Made for gyms in Pakistan
                    </span>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <h1 className="max-w-[900px] font-heading text-[clamp(40px,6vw,80px)] font-black leading-none tracking-[-0.04em]">
                        Run your gym from your phone. <span className="text-primary">Not a register.</span>
                    </h1>
                </FadeIn>
                <FadeIn delay={0.2}>
                    <p className="max-w-[620px] text-[clamp(17px,1.6vw,20px)] text-muted-foreground">
                        Members, fees, reminders and receipts in one place. Kettlio tells you who&apos;s due,
                        who&apos;s expired and who still owes you — in rupees.
                    </p>
                </FadeIn>
                <FadeIn delay={0.3} className="flex flex-wrap justify-center gap-3">
                    <Button asChild className="h-14 px-6 text-[17px] font-bold">
                        <Link href="#register">
                            Register your gym <ArrowRight className="size-[18px]" aria-hidden="true" />
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-14 bg-card px-5 text-[17px] font-semibold">
                        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                            <WhatsAppIcon /> Chat on WhatsApp
                        </a>
                    </Button>
                </FadeIn>
                <FadeIn delay={0.35}>
                    <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                        {reassurance.map((item) => (
                            <li key={item} className="flex items-center gap-1.5">
                                <Check className="size-4 text-primary" strokeWidth={2.6} aria-hidden="true" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </FadeIn>

                {/* Product preview (static illustration of the dashboard) */}
                <FadeIn delay={0.45} className="mt-10 w-full max-w-[1080px]">
                    <div
                        aria-hidden="true"
                        className="overflow-hidden rounded-t-xl border border-b-0 border-border bg-card text-left shadow-2xl"
                    >
                        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                            <span className="size-2.5 rounded-full bg-muted" />
                            <span className="size-2.5 rounded-full bg-muted" />
                            <span className="size-2.5 rounded-full bg-muted" />
                            <span className="ml-3 text-xs text-muted-foreground">kettlio.app/dashboard</span>
                        </div>
                        <div className="flex">
                            <div className="hidden w-[200px] shrink-0 flex-col gap-1 border-r border-border p-3 text-sm text-muted-foreground md:flex">
                                <div className="px-2.5 pb-3 pt-1 font-bold text-foreground">Iron Zone Gym</div>
                                {sidebarItems.map((item, i) => (
                                    <div
                                        key={item}
                                        className={
                                            i === 0
                                                ? "rounded-md bg-secondary px-2.5 py-2 font-semibold text-primary"
                                                : "px-2.5 py-2"
                                        }
                                    >
                                        {item}
                                    </div>
                                ))}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="font-heading text-[22px] font-extrabold">Dashboard</div>
                                    <div className="text-[13px] text-muted-foreground">November 2026</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    {stats.map((stat) => (
                                        <div key={stat.label} className="rounded-lg border border-border bg-background px-4 py-3.5">
                                            <div className="text-xs text-muted-foreground">{stat.label}</div>
                                            <div className={`font-heading text-[26px] font-extrabold ${stat.className}`}>
                                                {stat.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-border">
                                    <div className="min-w-[520px]">
                                        <div className="grid grid-cols-[2fr_1fr_1fr_1.3fr] gap-3 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            <div>Member</div>
                                            <div>Plan</div>
                                            <div>Amount</div>
                                            <div>Status</div>
                                        </div>
                                        {rows.map((row) => (
                                            <div
                                                key={row.name}
                                                className="grid grid-cols-[2fr_1fr_1fr_1.3fr] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
                                            >
                                                <div className="font-semibold">{row.name}</div>
                                                <div className="text-muted-foreground">{row.plan}</div>
                                                <div>{row.amount}</div>
                                                <div>
                                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[row.tone]}`}>
                                                        {row.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </FadeIn>
            </div>
        </section>
    )
}
