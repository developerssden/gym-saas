import {
    LayoutDashboard,
    Users,
    Package,
    CheckSquare,
    DollarSign,
    BarChart3,
} from "lucide-react"
import { FadeIn } from "@/components/landing-page/fade-in"

const features = [
    {
        name: "Dashboard",
        description:
            "Get a real-time overview of your gym's performance. Track active members, revenue, and daily check-ins at a glance.",
        icon: LayoutDashboard,
    },
    {
        name: "Member Management",
        description:
            "Easily manage member profiles, memberships, and attendance. Keep track of payments and renewals effortlessly.",
        icon: Users,
    },
    {
        name: "Inventory Tracking",
        description:
            "Keep track of your gym equipment and merchandise. Get alerts when stock is low and manage orders.",
        icon: Package,
    },
    {
        name: "Task Management",
        description:
            "Assign tasks to your staff and track their progress. Ensure your gym is always clean and well-maintained.",
        icon: CheckSquare,
    },
    {
        name: "Finance & Billing",
        description:
            "Automate billing and invoicing. Track expenses and revenue to understand your financial health.",
        icon: DollarSign,
    },
    {
        name: "Reporting & Analytics",
        description:
            "Deep dive into data with comprehensive reports. Make data-driven decisions to grow your business.",
        icon: BarChart3,
    },
]

export function Features() {
    return (
        <section
            id="features"
            className="container space-y-6 bg-slate-50 py-8 dark:bg-transparent md:py-12 lg:py-24 mx-auto px-4"
        >
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                <FadeIn>
                    <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
                        Everything you need to run your gym
                    </h2>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        Our platform provides all the tools you need to manage your gym efficiently, from member management to financial reporting.
                    </p>
                </FadeIn>
            </div>
            <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
                {features.map((feature, index) => (
                    <FadeIn
                        key={feature.name}
                        delay={0.1 + index * 0.1}
                        className="relative overflow-hidden rounded-lg border bg-background p-2 transition-all hover:scale-105 hover:shadow-lg"
                    >
                        <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                            <feature.icon className="h-12 w-12 text-primary" />
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
