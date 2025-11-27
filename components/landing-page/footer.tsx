import Link from "next/link"
import { Dumbbell } from "lucide-react"

export function Footer() {
    return (
        <footer className="border-t bg-background">
            <div className="container flex flex-col gap-8 py-8 md:py-12 mx-auto px-4">
                <div className="flex flex-col gap-6 md:flex-row md:justify-between">
                    <div className="flex flex-col gap-2">
                        <Link href="/" className="flex items-center gap-2">
                            <Dumbbell className="h-6 w-6" />
                            <span className="text-lg font-bold">GymSaaS</span>
                        </Link>
                        <p className="text-sm text-muted-foreground">
                            The all-in-one platform for modern gym management.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-medium">Product</h3>
                            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">
                                Features
                            </Link>
                            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
                                Pricing
                            </Link>
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                Integrations
                            </Link>
                        </div>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-medium">Company</h3>
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                About
                            </Link>
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                Blog
                            </Link>
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                Careers
                            </Link>
                        </div>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-medium">Legal</h3>
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                Privacy
                            </Link>
                            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                Terms
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-xs text-muted-foreground">
                        &copy; {new Date().getFullYear()} GymSaaS Inc. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
}
