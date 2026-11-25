import { CONTACT } from "@/constants/landing";
import type { PlanStatus, UsageItem } from "@/lib/my-plan";
import { cn } from "@/lib/utils";

/** GET /api/subscription/myplan, shared by the Subscription page and Profile → Plan & billing. */
export type MyPlanResponse = {
  status: PlanStatus;
  plan: {
    name: string;
    billing_model: string;
    price: number;
    /** Plan has no fixed price (e.g. Pro): show "Custom pricing", not the stored number. */
    custom_pricing: boolean;
    start_date: string;
    end_date: string;
  } | null;
  features: string[];
  usage: UsageItem[];
};

export const MY_PLAN_QUERY_KEY = ["my-plan"] as const;

export const renewUrl = (planName?: string) =>
  `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(
    planName ? `Hi, I'd like to renew or upgrade my Kettlio plan (${planName}).` : "Hi, I'd like to start a Kettlio plan."
  )}`;

const chip = "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Lime = active, amber = ending soon, red = expired, muted = no plan. */
export function PlanStatusChip({ status }: { status: PlanStatus }) {
  if (status.kind === "active") return <span className={cn(chip, "bg-status-active text-status-active-foreground")}>Active</span>;
  if (status.kind === "expiring") {
    return (
      <span className={cn(chip, "bg-amber-500/15 text-amber-800 dark:text-amber-300")}>
        Ends in {status.daysLeft} day{status.daysLeft === 1 ? "" : "s"}
      </span>
    );
  }
  if (status.kind === "expired") return <span className={cn(chip, "bg-destructive/10 text-destructive")}>Expired</span>;
  return <span className={cn(chip, "bg-muted text-muted-foreground")}>No plan</span>;
}
