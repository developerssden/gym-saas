"use client"

import * as React from "react"
import Link from "next/link"
import { animate } from "framer-motion"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet"

const navigation = [
    { name: "Features", href: "#features" },
    { name: "Testimonials", href: "#testimonials" },
    { name: "Pricing", href: "#pricing" },
]

export function LandingHeader() {
    const [isOpen, setIsOpen] = React.useState(false)
    const handleNavigation = React.useCallback((href: string) => {
        if (typeof window === "undefined") return

        const section = document.querySelector<HTMLElement>(href)
        if (!section) return

        const y =
            section.getBoundingClientRect().top + window.scrollY - 72 // offset sticky header

        animate(window.scrollY, y, {
            duration: 0.8,
            ease: "easeInOut",
            onUpdate: (latest) => window.scrollTo({ top: latest }),
        })
    }, [])

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
            <div className="container mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8">
                <div className="mr-4 hidden md:flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <span className="hidden font-bold sm:inline-block">
                            GymSaaS
                        </span>
                    </Link>
                    <nav className="flex items-center gap-6 text-sm">
                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="transition-colors hover:text-foreground/80 text-foreground/60"
                                onClick={(event) => {
                                    event.preventDefault()
                                    handleNavigation(item.href)
                                }}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </div>
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
                        >
                            <Menu className="h-6 w-6" />
                            <span className="sr-only">Toggle Menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="pr-0">
                        <div className="px-7">
                            <Link
                                href="/"
                                className="flex items-center"
                                onClick={() => setIsOpen(false)}
                            >
                                <span className="font-bold">GymSaaS</span>
                            </Link>
                        </div>
                        <div className="flex flex-col gap-4 mt-4 px-7">
                            {navigation.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="block text-lg font-medium transition-colors hover:text-foreground/80 text-foreground/60"
                                    onClick={(event) => {
                                        event.preventDefault()
                                        setIsOpen(false)
                                        handleNavigation(item.href)
                                    }}
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                    </div>
                    <nav className="flex items-center gap-2">
                        <Link href="/login">
                            <Button variant="ghost" size="sm">
                                Log in
                            </Button>
                        </Link>
                        <Link href="/signup">
                            <Button size="sm">
                                Get Started
                            </Button>
                        </Link>
                    </nav>
                </div>
            </div>
        </header>
    )
}
