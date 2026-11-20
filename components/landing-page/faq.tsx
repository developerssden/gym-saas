import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/landing-page/fade-in"
import { Eyebrow, SectionTitle } from "@/components/landing-page/section-heading"
import { WhatsAppIcon } from "@/components/landing-page/whatsapp-icon"
import { CONTACT, WHATSAPP_URL } from "@/constants/landing"

const faqs = [
    {
        q: "Do my members need to download anything?",
        a: "No. Kettlio is for you and your staff. Your members don't need to install anything or create an account.",
    },
    {
        q: "I keep everything in a register. Can I still switch?",
        a: "Yes. If your members are in Excel, we import them all at once. If they're on paper, just register — we'll move all your members into the app for you, then give you a demo so you know exactly how to use it.",
    },
    {
        q: "Does it work on my phone?",
        a: "Yes — Android, iPhone and computer. Add it to your home screen and it opens like a normal app, and you get a phone notification when a membership runs out.",
    },
    {
        q: "I have more than one branch. Is that one account?",
        a: "Yes. Run all your gyms and locations from one login and switch between them in a tap.",
    },
    {
        q: "How much does it cost?",
        a: "The Starter plan is PKR 5,000 a month. Setup and moving your members into the app are free. Have a bigger gym or more than one branch? Register and we'll suggest the plan that fits.",
    },
    {
        q: "What happens after I register?",
        a: `We call or WhatsApp you within ${CONTACT.callbackWindow}, set up your gym's account, move your members in, and give you a demo. You'll get a login link by email to get started.`,
    },
]

export function FAQ() {
    return (
        <section id="faq" className="dark scroll-mt-16 bg-background text-foreground">
            <div className="mx-auto flex max-w-[1200px] flex-wrap gap-14 px-6 py-24 md:py-28">
                <FadeIn className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
                    <Eyebrow>FAQ</Eyebrow>
                    <SectionTitle>Questions gym owners ask us</SectionTitle>
                    <p className="text-[17px] text-muted-foreground">
                        Something else on your mind? Message us — a real person replies.
                    </p>
                    <Button asChild variant="outline" className="mt-2 h-12 self-start bg-card px-5 text-base font-semibold">
                        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                            <WhatsAppIcon /> Chat on WhatsApp
                        </a>
                    </Button>
                </FadeIn>

                <FadeIn delay={0.1} className="min-w-0 flex-[2_1_560px]">
                    <Accordion type="single" collapsible defaultValue="item-0" className="border-t border-border">
                        {faqs.map((faq, index) => (
                            <AccordionItem key={faq.q} value={`item-${index}`} className="border-border">
                                <AccordionTrigger className="py-5 text-lg font-semibold hover:no-underline">
                                    {faq.q}
                                </AccordionTrigger>
                                <AccordionContent className="max-w-[640px] pb-5 text-base text-muted-foreground">
                                    {faq.a}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </FadeIn>
            </div>
        </section>
    )
}
