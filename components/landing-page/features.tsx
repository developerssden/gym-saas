import {
    BellRing,
    ClipboardCheck,
    LayoutDashboard,
    Users,
    Megaphone,
    Smartphone,
} from "lucide-react"
import { FadeIn } from "@/components/landing-page/fade-in"

const features = [
    {
        name: "Keep members moving",
        description:
            "Manage member profiles, membership plans, subscriptions, payment records, and expiry dates from one place.",
        icon: LayoutDashboard,
    },
    {
        name: "Stay ahead of renewals",
        description:
            "Expiry reminders can be delivered by email and push so follow-up does not depend on a spreadsheet.",
        icon: BellRing,
    },
    {
        name: "See every location",
        description:
            "Organize gyms, locations, members, and equipment with role-based access for the people who run them.",
        icon: Users,
    },
    {
        name: "Keep the floor ready",
        description:
            "Track equipment and assign tasks so maintenance and daily operations have a clear home.",
        icon: ClipboardCheck,
    },
    {
        name: "Communicate clearly",
        description:
            "Send announcements and keep important updates visible to the right audience.",
        icon: Megaphone,
    },
    {
        name: "Work from anywhere",
        description:
            "Use the installable PWA on supported devices, with offline fallback and push notification support.",
        icon: Smartphone,
    },
]

export function Features() {
    return (
        <section
            id="features"
            className="landing-section landing-container space-y-10"
        >
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                <FadeIn>
                    <p className="landing-eyebrow">Built around outcomes</p>
                    <h2 className="landing-heading">
                        Less chasing. More running.
                    </h2>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        The useful parts of gym operations are connected, so owners can spend less time reconstructing what happened.
                    </p>
                </FadeIn>
            </div>
            <div className="mx-auto grid w-full justify-center gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, index) => (
                    <FadeIn
                        key={feature.name}
                        delay={0.1 + index * 0.1}
                        className="relative overflow-hidden rounded-2xl border bg-card p-2 transition-shadow hover:shadow-lg"
                    >
                        <div className="flex min-h-[210px] flex-col justify-between rounded-xl p-6">
                            <feature.icon className="h-8 w-8 text-primary" />
                            <div className="space-y-2">
                                <h3 className="font-bold">{feature.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    </FadeIn>
                ))}
            </div>
        </section>
    )
}
