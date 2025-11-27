import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { FadeIn } from "@/components/landing-page/fade-in"

const testimonials = [
    {
        name: "Sarah Johnson",
        role: "Owner, FitLife Gym",
        content:
            "GymSaaS has completely transformed how I run my business. I save hours every week on admin tasks and can focus more on my members.",
        avatar: "/avatars/01.png",
        initials: "SJ",
    },
    {
        name: "Mike Chen",
        role: "Manager, Iron Paradise",
        content:
            "The inventory management feature is a game-changer. We never run out of supplements or gear anymore. Highly recommended!",
        avatar: "/avatars/02.png",
        initials: "MC",
    },
    {
        name: "Emily Davis",
        role: "Owner, Yoga Studio X",
        content:
            "I love the financial reporting tools. It's so easy to see where we're making money and where we can improve. The UI is beautiful too.",
        avatar: "/avatars/03.png",
        initials: "ED",
    },
]

export function Testimonials() {
    return (
        <section
            id="testimonials"
            className="container space-y-6 py-8 md:py-12 lg:py-24 mx-auto px-4"
        >
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                <FadeIn>
                    <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
                        Trusted by gym owners worldwide
                    </h2>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        Don't just take our word for it. Here's what our customers have to say about GymSaaS.
                    </p>
                </FadeIn>
            </div>
            <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
                {testimonials.map((testimonial, index) => (
                    <FadeIn
                        key={testimonial.name}
                        delay={0.1 + index * 0.1}
                    >
                        <Card className="flex flex-col justify-between h-full transition-all hover:scale-105 hover:shadow-lg">
                            <CardHeader className="flex-row gap-4 items-center">
                                <Avatar>
                                    <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                                    <AvatarFallback>{testimonial.initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <p className="text-sm font-medium leading-none">{testimonial.name}</p>
                                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    "{testimonial.content}"
                                </p>
                            </CardContent>
                        </Card>
                    </FadeIn>
                ))}
            </div>
        </section>
    )
}
