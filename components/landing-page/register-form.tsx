"use client"

import * as React from "react"
import axios from "axios"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FadeIn } from "@/components/landing-page/fade-in"
import { Eyebrow } from "@/components/landing-page/section-heading"
import { WhatsAppIcon } from "@/components/landing-page/whatsapp-icon"
import { CONTACT, WHATSAPP_URL } from "@/constants/landing"
import { CITY_OPTIONS, MEMBER_COUNT_OPTIONS, gymRegistrationSchema } from "@/lib/registrations/schema"

const nextSteps = [
    { title: "We call or WhatsApp you", body: `Within ${CONTACT.callbackWindow}, to understand your gym.` },
    { title: "We move your members in", body: "From Excel or your paper register — we do it for you, free." },
    { title: "We give you a demo", body: "A quick walkthrough so you know how to use it from day one." },
]

const emptyForm = { owner_name: "", gym_name: "", phone: "", city: "", member_count: "", message: "" }
type FormState = typeof emptyForm
type FieldErrors = Partial<Record<keyof FormState, string>>

const fieldClass = "h-12 bg-background text-[15px] md:text-[15px]"
const selectClass =
    "h-12 w-full rounded-md border border-input bg-background px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"

export function RegisterForm() {
    const [form, setForm] = React.useState<FormState>(emptyForm)
    const [errors, setErrors] = React.useState<FieldErrors>({})
    const [honeypot, setHoneypot] = React.useState("")
    const [status, setStatus] = React.useState<"idle" | "submitting" | "done" | "error">("idle")

    const update = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }))
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const parsed = gymRegistrationSchema.safeParse(form)
        if (!parsed.success) {
            const next: FieldErrors = {}
            for (const issue of parsed.error.issues) {
                const key = issue.path[0] as keyof FormState
                if (!next[key]) next[key] = issue.message
            }
            setErrors(next)
            return
        }
        setStatus("submitting")
        try {
            await axios.post("/api/registrations/create", { ...parsed.data, website: honeypot })
            setStatus("done")
            setForm(emptyForm)
        } catch (err) {
            const fieldErrors = axios.isAxiosError(err)
                ? (err.response?.data?.fieldErrors as Record<string, string[] | undefined> | undefined)
                : undefined
            if (fieldErrors) {
                const next: FieldErrors = {}
                for (const key of Object.keys(emptyForm) as (keyof FormState)[]) {
                    const message = fieldErrors[key]?.[0]
                    if (message) next[key] = message
                }
                if (Object.keys(next).length > 0) {
                    setErrors(next)
                    setStatus("idle")
                    return
                }
            }
            setStatus("error")
        }
    }

    const errorText = (field: keyof FormState) =>
        errors[field] ? (
            <p id={`${field}-error`} className="text-sm text-destructive">
                {errors[field]}
            </p>
        ) : null

    const ariaFor = (field: keyof FormState) => ({
        "aria-invalid": !!errors[field] || undefined,
        "aria-describedby": errors[field] ? `${field}-error` : undefined,
    })

    return (
        <section id="register" className="theme-light scroll-mt-16 bg-background text-foreground">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-14 px-6 py-24 md:py-28">
                <FadeIn className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
                    <Eyebrow>Register your gym</Eyebrow>
                    <h2 className="font-heading text-[clamp(34px,4.4vw,56px)] font-black leading-[1.02] tracking-[-0.035em]">
                        Register your gym and make management{" "}
                        <span className="bg-[linear-gradient(transparent_60%,var(--primary)_60%)] px-1">easy.</span>
                    </h2>
                    <p className="max-w-[480px] text-lg text-muted-foreground">
                        Leave your details and we&apos;ll get your gym set up on Kettlio — free setup, no commitment.
                    </p>
                    <div className="mt-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">What happens next</div>
                    <ol className="flex flex-col gap-4">
                        {nextSteps.map((step, index) => (
                            <li key={step.title} className="flex items-start gap-3.5">
                                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-foreground font-heading text-sm font-black text-primary">
                                    {index + 1}
                                </span>
                                <div>
                                    <div className="font-bold">{step.title}</div>
                                    <div className="text-[15px] text-muted-foreground">{step.body}</div>
                                </div>
                            </li>
                        ))}
                    </ol>
                </FadeIn>

                <FadeIn
                    delay={0.1}
                    className="min-w-0 flex-[1_1_440px] rounded-xl border border-border bg-surface p-6 shadow-xl sm:p-9"
                >
                    {status === "done" ? (
                        <div role="status" className="flex flex-col items-center gap-4 px-2 py-12 text-center">
                            <div className="flex size-16 items-center justify-center rounded-full bg-primary">
                                <Check className="size-[30px] text-primary-foreground" strokeWidth={2.6} aria-hidden="true" />
                            </div>
                            <h3 className="font-heading text-[28px] font-extrabold tracking-tight">Thanks — your gym is registered.</h3>
                            <p className="max-w-[360px] text-muted-foreground">
                                We&apos;ll call or WhatsApp you within {CONTACT.callbackWindow} to set up your account.
                            </p>
                            <Button variant="ghost" className="h-11 font-semibold text-primary-dim" onClick={() => setStatus("idle")}>
                                Register another gym
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="owner_name" className="text-sm font-semibold">Your name</Label>
                                    <Input id="owner_name" autoComplete="name" placeholder="e.g. Ahmed Ali" value={form.owner_name} onChange={update("owner_name")} className={fieldClass} {...ariaFor("owner_name")} />
                                    {errorText("owner_name")}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="gym_name" className="text-sm font-semibold">Gym name</Label>
                                    <Input id="gym_name" autoComplete="organization" placeholder="e.g. Iron Zone Gym" value={form.gym_name} onChange={update("gym_name")} className={fieldClass} {...ariaFor("gym_name")} />
                                    {errorText("gym_name")}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="phone" className="text-sm font-semibold">Phone / WhatsApp number</Label>
                                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" value={form.phone} onChange={update("phone")} className={fieldClass} {...ariaFor("phone")} />
                                {errorText("phone")}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="city" className="text-sm font-semibold">City</Label>
                                    <select id="city" value={form.city} onChange={update("city")} className={selectClass} {...ariaFor("city")}>
                                        <option value="">Choose your city</option>
                                        {CITY_OPTIONS.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    {errorText("city")}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="member_count" className="text-sm font-semibold">Number of members</Label>
                                    <select id="member_count" value={form.member_count} onChange={update("member_count")} className={selectClass} {...ariaFor("member_count")}>
                                        <option value="">Roughly how many?</option>
                                        {MEMBER_COUNT_OPTIONS.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    {errorText("member_count")}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="message" className="text-sm font-semibold">
                                    Anything we should know? <span className="font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <Textarea id="message" rows={3} placeholder="e.g. We have two branches and keep everything in a register." value={form.message} onChange={update("message")} className="bg-background text-[15px] md:text-[15px]" {...ariaFor("message")} />
                                {errorText("message")}
                            </div>

                            {/* Honeypot: hidden from people, bots tend to fill it in. */}
                            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                                <label htmlFor="website">Website</label>
                                <input id="website" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                            </div>

                            {status === "error" && (
                                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                                    Something went wrong. Please try again, or message us on WhatsApp.
                                </p>
                            )}

                            <Button type="submit" disabled={status === "submitting"} className="h-12 text-[17px] font-bold">
                                {status === "submitting" ? (
                                    <>
                                        <Loader2 className="size-[18px] animate-spin" aria-hidden="true" /> Sending…
                                    </>
                                ) : (
                                    <>
                                        Register your gym <ArrowRight className="size-[18px]" aria-hidden="true" />
                                    </>
                                )}
                            </Button>
                            <p className="text-center text-[13px] text-muted-foreground">
                                We&apos;ll only use your number to contact you about Kettlio.
                            </p>
                            <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                                <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
                            </div>
                            <Button asChild variant="outline" className="h-12 bg-background text-base font-semibold">
                                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                                    <WhatsAppIcon /> Register on WhatsApp instead
                                </a>
                            </Button>
                        </form>
                    )}
                </FadeIn>
            </div>
        </section>
    )
}
