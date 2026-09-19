import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FadeIn } from "@/components/landing-page/fade-in"

const operatingModel = [
    {
        name: "01 / Sign in",
        role: "Start with the access you already have",
        content: "Gym owner accounts use the existing sign-in and invite-based onboarding flow.",
    },
    {
        name: "02 / Organize",
        role: "Add the places and people you manage",
        content: "Set up gyms, locations, members, equipment, subscriptions, and the tasks your team needs to see.",
    },
    {
        name: "03 / Follow through",
        role: "Keep renewals and operations visible",
        content: "Expiry reminders, payment records, announcements, and dashboard views keep the next action close at hand.",
    },
]

export function HowItWorks() {
    return (
        <section
            id="how-it-works"
            className="landing-section landing-container space-y-10"
        >
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                <FadeIn>
                    <p className="landing-eyebrow">How it works</p>
                    <h2 className="landing-heading">
                        A calmer operating rhythm.
                    </h2>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        A straightforward path from access to a useful owner workspace.
                    </p>
                </FadeIn>
            </div>
            <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
                {operatingModel.map((testimonial, index) => (
                    <FadeIn
                        key={testimonial.name}
                        delay={0.1 + index * 0.1}
                    >
                        <Card className="flex flex-col justify-between h-full transition-all hover:scale-105 hover:shadow-lg">
                            <CardHeader className="flex-row gap-4 items-center">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</div>
                                <div className="flex flex-col">
                                    <p className="text-sm font-medium leading-none">{testimonial.name}</p>
                                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    &quot;{testimonial.content}&quot;
                                </p>
                            </CardContent>
                        </Card>
                    </FadeIn>
                ))}
            </div>
        </section>
    )
}
