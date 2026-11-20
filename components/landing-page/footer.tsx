import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { KettlioLogo } from "@/components/landing-page/logo"
import { CONTACT, LANDING_NAV, WHATSAPP_URL } from "@/constants/landing"

export function Footer() {
    return (
        <footer className="dark bg-background text-muted-foreground">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-6 pb-8 pt-14">
                <div className="flex flex-wrap justify-between gap-10">
                    <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
                        <Link href="/" aria-label="Kettlio home" className="text-foreground">
                            <KettlioLogo size={28} />
                        </Link>
                        <p className="max-w-[300px] text-[15px]">
                            Gym management made easy — members, fees and reminders in one place.
                        </p>
                    </div>
                    <nav aria-label="Footer" className="flex flex-col gap-2.5 text-[15px]">
                        <div className="text-sm font-bold text-foreground">Product</div>
                        {LANDING_NAV.map((item) => (
                            <Link key={item.href} href={item.href} className="hover:text-foreground">
                                {item.name}
                            </Link>
                        ))}
                        <Link href="/sign-in" className="hover:text-foreground">
                            Sign in
                        </Link>
                    </nav>
                    <div className="flex flex-col gap-2.5 text-[15px]">
                        <div className="text-sm font-bold text-foreground">Contact</div>
                        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                            WhatsApp: {CONTACT.whatsappDisplay}
                        </a>
                        <a href={`mailto:${CONTACT.email}`} className="hover:text-foreground">
                            {CONTACT.email}
                        </a>
                        <a
                            href={CONTACT.founderLinkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary hover:underline"
                        >
                            {CONTACT.founderName} on LinkedIn <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </a>
                    </div>
                </div>
                <div className="border-t border-border pt-6 text-sm">© {new Date().getFullYear()} Kettlio · Gujrat, Pakistan</div>
            </div>
        </footer>
    )
}
