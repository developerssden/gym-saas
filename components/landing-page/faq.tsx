"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { contactEmail } from "./contact"

const questions = [
  ["How do I get access?", "Gym owner accounts are provisioned through the existing sign-in and invite flow. Contact the team to arrange access."],
  ["How are subscriptions and payments handled?", "GymSaaS tracks owner and member subscriptions, billing intervals, expiry dates, and payment records. Owner plan checkout is handled through Polar."],
  ["Can I manage more than one location?", "Yes. The plan data includes gym and location limits, and the dashboard models gyms, locations, members, and equipment together."],
  ["What notifications are supported?", "The app supports expiry reminders through email and push notifications, plus in-app announcements and notifications."],
  ["Can I use it on a phone?", "GymSaaS is built as an installable PWA, with an offline fallback and push notification support where the device and browser allow it."],
  ["How can I ask a question?", [`Email ${contactEmail} and the team can help with access, plans, and product questions.`]],
] as const

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="landing-section border-t">
      <div className="landing-container grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <div><p className="landing-eyebrow">Questions, answered</p><h2 className="landing-heading">The practical details.</h2><p className="mt-4 text-muted-foreground">No inflated promises. Just the parts owners need to know before they get started.</p></div>
        <div className="divide-y rounded-2xl border bg-card">
          {questions.map(([question, answer], index) => <div key={question}><button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span>{question}</span><ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open === index ? "rotate-180" : ""}`} /></button>{open === index && <p className="px-5 pb-5 text-sm leading-6 text-muted-foreground">{answer}</p>}</div>)}
        </div>
      </div>
    </section>
  )
}