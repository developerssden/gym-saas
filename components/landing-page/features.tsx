import { Bell, CheckSquare, Dumbbell, FileText, MapPin, Search, Smartphone, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { FadeIn } from "@/components/landing-page/fade-in"
import { Eyebrow, SectionTitle } from "@/components/landing-page/section-heading"

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
    return (
        <div className="flex size-11 items-center justify-center rounded-lg bg-sidebar-primary-soft">
            <Icon className="size-[22px] text-secondary-foreground" aria-hidden="true" />
        </div>
    )
}

const smallFeatures = [
    {
        icon: FileText,
        title: "Payments & PDF receipts",
        body: "Record cash or transfer in seconds and share a proper receipt. No more “I already paid”.",
    },
    {
        icon: Dumbbell,
        title: "Equipment register",
        body: "Every machine, its condition and what needs repair — so nothing sits broken for weeks.",
    },
    {
        icon: CheckSquare,
        title: "Staff to-dos",
        body: "Cleaning, repairs, follow-up calls — write it once, tick it off when it's done.",
    },
]

const memberRows = [
    { name: "Ali Raza", status: "Due in 2 days", className: "bg-amber-100 text-amber-800" },
    { name: "Usman Butt", status: "Paid · 3 months", className: "bg-status-active text-status-active-foreground" },
    { name: "Hamza Khan", status: "Expired", className: "bg-red-100 text-red-700" },
]

export function Features() {
    return (
        <section id="features" className="theme-light scroll-mt-16 bg-background text-foreground">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-6 py-24 md:py-28">
                <FadeIn className="flex flex-col items-center gap-3.5 text-center">
                    <Eyebrow>Features</Eyebrow>
                    <SectionTitle className="max-w-[760px]">Everything your front desk needs. Nothing it doesn&apos;t.</SectionTitle>
                    <p className="max-w-[560px] text-[17px] text-muted-foreground">
                        Built for gym owners, not IT departments. If you can use WhatsApp, you can use Kettlio.
                    </p>
                </FadeIn>

                <div className="flex flex-wrap gap-5">
                    {/* Members & fees */}
                    <FadeIn className="flex min-w-0 flex-[2_1_560px] flex-wrap items-center gap-7 rounded-[10px] border border-border bg-surface p-7">
                        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-3">
                            <IconTile icon={Users} />
                            <h3 className="text-[22px] font-bold">Members &amp; fees</h3>
                            <p className="text-[15px] text-muted-foreground">
                                Every member, their plan, when they paid and when they&apos;re due — searchable in a second.
                                Monthly or yearly, all in rupees.
                            </p>
                        </div>
                        <div aria-hidden="true" className="flex min-w-0 flex-[1_1_280px] flex-col gap-2 rounded-lg bg-muted p-3.5">
                            <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-muted-foreground">
                                <Search className="size-3.5" /> Search members…
                            </div>
                            {memberRows.map((row) => (
                                <div key={row.name} className="flex items-center justify-between rounded-md bg-surface px-3 py-2.5 text-[13px]">
                                    <span className="font-semibold">{row.name}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.className}`}>{row.status}</span>
                                </div>
                            ))}
                        </div>
                    </FadeIn>

                    {/* Reminders — highlighted */}
                    <FadeIn delay={0.1} className="dark flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-[10px] bg-card p-7 text-foreground">
                        <div className="flex size-11 items-center justify-center rounded-lg bg-primary">
                            <Bell className="size-[22px] text-primary-foreground" aria-hidden="true" />
                        </div>
                        <h3 className="text-[22px] font-bold">Expiry alerts</h3>
                        <p className="text-[15px] text-muted-foreground">
                            The day a membership runs out you hear about it — on your phone, in the app and by email. Plus a
                            PDF list of everyone who has lapsed.
                        </p>
                        <div aria-hidden="true" className="mt-auto flex flex-col gap-2 pt-2 text-[13px] text-secondary-foreground">
                            <div className="rounded-md bg-secondary px-3 py-2.5">3 members expired today</div>
                            <div className="rounded-md bg-secondary px-3 py-2.5">Download the list as a PDF</div>
                        </div>
                    </FadeIn>

                    {smallFeatures.map((feature, index) => (
                        <FadeIn
                            key={feature.title}
                            delay={0.1 + index * 0.1}
                            className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-[10px] border border-border bg-surface p-7"
                        >
                            <IconTile icon={feature.icon} />
                            <h3 className="text-xl font-bold">{feature.title}</h3>
                            <p className="text-[15px] text-muted-foreground">{feature.body}</p>
                        </FadeIn>
                    ))}

                    {/* Branches */}
                    <FadeIn className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-[10px] border border-border bg-surface p-7">
                        <IconTile icon={MapPin} />
                        <h3 className="text-xl font-bold">More than one branch</h3>
                        <p className="text-[15px] text-muted-foreground">
                            Run every gym and location from one login and switch between them in a tap.
                        </p>
                        <div aria-hidden="true" className="mt-auto flex flex-wrap gap-2 pt-1.5 text-[13px] font-semibold">
                            <span className="rounded-full bg-foreground px-3 py-1.5 text-background">Iron Zone · Gujrat</span>
                            <span className="rounded-full bg-muted px-3 py-1.5">Iron Zone · Lahore</span>
                        </div>
                    </FadeIn>

                    {/* Installs like an app */}
                    <FadeIn
                        delay={0.1}
                        className="flex min-w-0 flex-[2_1_560px] flex-wrap items-center justify-between gap-6 rounded-[10px] bg-sidebar-primary-soft p-7"
                    >
                        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
                            <div className="dark flex size-11 items-center justify-center rounded-lg bg-background">
                                <Smartphone className="size-[22px] text-primary" aria-hidden="true" />
                            </div>
                            <h3 className="text-[22px] font-bold">Installs like an app</h3>
                            <p className="text-[15px] text-secondary-foreground">
                                Add Kettlio to your home screen on Android or iPhone — no Play Store, no updates to download.
                                Works on your computer too.
                            </p>
                        </div>
                        <div aria-hidden="true" className="flex flex-wrap gap-2.5 text-[13px] font-bold">
                            {["Android", "iPhone", "Computer"].map((p) => (
                                <span key={p} className="rounded-full bg-surface px-3.5 py-2">{p}</span>
                            ))}
                        </div>
                    </FadeIn>
                </div>
            </div>
        </section>
    )
}
