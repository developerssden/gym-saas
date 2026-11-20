"use client"

import * as React from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { KettlioLogo } from "@/components/landing-page/logo"
import { LANDING_NAV } from "@/constants/landing"

export function LandingHeader() {
    const [isOpen, setIsOpen] = React.useState(false)

    return (
        <header className="dark sticky top-0 z-50 w-full border-b border-border bg-background/90 text-foreground backdrop-blur supports-backdrop-filter:bg-background/75">
            <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
                <Link href="/" aria-label="Kettlio home">
                    <KettlioLogo />
                </Link>

                <nav aria-label="Main" className="hidden items-center gap-7 text-[15px] font-medium md:flex">
                    {LANDING_NAV.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    <Link
                        href="/sign-in"
                        className="hidden min-h-11 items-center px-3 text-[15px] font-semibold sm:inline-flex"
                    >
                        Sign in
                    </Link>
                    <Button asChild className="h-11 px-3 text-sm font-bold sm:px-4 sm:text-[15px]">
                        <Link href="/#register">
                            Register<span className="max-[379px]:hidden">&nbsp;your gym</span>
                        </Link>
                    </Button>

                    <Sheet open={isOpen} onOpenChange={setIsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="Open menu">
                                <Menu className="size-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="dark bg-background text-foreground">
                            <SheetTitle className="sr-only">Menu</SheetTitle>
                            <div className="flex flex-col gap-2 px-6 pt-10">
                                {LANDING_NAV.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsOpen(false)}
                                        className="py-2 text-lg font-medium text-muted-foreground hover:text-foreground"
                                    >
                                        {item.name}
                                    </Link>
                                ))}
                                <Link
                                    href="/sign-in"
                                    onClick={() => setIsOpen(false)}
                                    className="py-2 text-lg font-medium text-muted-foreground hover:text-foreground"
                                >
                                    Sign in
                                </Link>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}
