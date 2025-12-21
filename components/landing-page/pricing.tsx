import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { FadeIn } from "@/components/landing-page/fade-in"

export function Pricing() {
    return (
        <section
            id="pricing"
            className="container space-y-6 bg-slate-50 py-8 dark:bg-transparent md:py-12 lg:py-24 mx-auto px-4"
        >
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                <FadeIn>
                    <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl font-bold">
                        Simple, transparent pricing
                    </h2>
                </FadeIn>
                <FadeIn delay={0.1}>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        Choose the plan that's right for your gym. No hidden fees.
                    </p>
                </FadeIn>
            </div>
            <div className="grid w-full items-start gap-10 rounded-lg border p-10 md:grid-cols-2 md:gap-8">
                <FadeIn delay={0.2} className="grid gap-6">
                    <Card className="transition-all hover:scale-105 hover:shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-2xl">Basic</CardTitle>
                            <CardDescription>
                                Essential features for small to medium gyms.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="text-4xl font-bold">
                                PKR 5000
                                <span className="text-lg font-normal text-muted-foreground">
                                    /month
                                </span>
                            </div>
                            <ul className="grid gap-2 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" />  1 Gym Location Management
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> 200 Members in each Gym Management
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> Dashboard & Reporting
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> 200 Items in Inventory Tracking
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> 200 Members
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" />  Unlimited Task Management
                                </li>
                                
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Link href="/signup" className="w-full">
                                <Button className="w-full">Get Started</Button>
                            </Link>
                        </CardFooter>
                    </Card>
                </FadeIn>
                <FadeIn delay={0.3} className="grid gap-6">
                    <Card className="transition-all hover:scale-105 hover:shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-2xl">Enterprise</CardTitle>
                            <CardDescription>
                                For large gym chains and franchises.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="text-4xl font-bold">
                                Contact Us
                            </div>
                            <ul className="grid gap-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> Unlimited Members
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> Advanced Analytics
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> Dedicated Support
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> Custom number of Gym & Location
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> Custom number of Members in each Gym
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-primary" /> Custom number of Items in Inventory Tracking
                                </li>

                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Link href="/contact" className="w-full">
                                <Button variant="outline" className="w-full">Contact Sales</Button>
                            </Link>
                        </CardFooter>
                    </Card>
                </FadeIn>
            </div>
        </section>
    )
}
