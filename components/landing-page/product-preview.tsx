import {
  BellRing,
  CircleCheck,
  CreditCard,
  MapPin,
  Users,
} from "lucide-react"

export function ProductPreview() {
  return (
    <div className="landing-preview mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          GymSaaS overview
        </div>
        <span className="text-xs text-muted-foreground">Owner workspace</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[0.8fr_1.2fr] sm:p-6">
        <div className="space-y-4 rounded-xl bg-primary p-5 text-primary-foreground">
          <div>
            <p className="text-sm opacity-80">Today&apos;s snapshot</p>
            <p className="mt-2 text-3xl font-bold">Your gym, in view.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-primary-foreground/10 p-3"><Users className="mb-2 h-4 w-4" /><strong>Members</strong><p className="opacity-75">Active roster</p></div>
            <div className="rounded-lg bg-primary-foreground/10 p-3"><MapPin className="mb-2 h-4 w-4" /><strong>Locations</strong><p className="opacity-75">Across your gyms</p></div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4"><BellRing className="h-5 w-5 text-primary" /><p className="mt-5 text-sm font-semibold">Renewal reminders</p><p className="mt-1 text-xs text-muted-foreground">Email and push alerts keep follow-up visible.</p></div>
          <div className="rounded-xl border p-4"><CreditCard className="h-5 w-5 text-primary" /><p className="mt-5 text-sm font-semibold">Payment records</p><p className="mt-1 text-xs text-muted-foreground">See subscription payments alongside members.</p></div>
          <div className="rounded-xl border p-4 sm:col-span-2"><div className="flex items-center justify-between"><p className="text-sm font-semibold">This week</p><span className="text-xs text-primary">On track</span></div><div className="mt-4 space-y-3"><div className="flex items-center gap-3 text-sm"><CircleCheck className="h-4 w-4 text-primary" />Review expiring memberships</div><div className="flex items-center gap-3 text-sm"><CircleCheck className="h-4 w-4 text-primary" />Check equipment maintenance</div></div></div>
        </div>
      </div>
    </div>
  )
}