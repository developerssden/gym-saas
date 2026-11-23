import { cn } from "@/lib/utils";
import type { MembershipState } from "@/lib/members/member-status";

/**
 * Membership status chip: lime = active, amber = expiring, red = expired,
 * neutral = frozen / no membership. Same colours on the list, profile and dashboard.
 */
export function MemberStatusBadge({ state, label, className }: { state: MembershipState; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        state === "active" && "bg-status-active text-status-active-foreground",
        state === "expiring" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        state === "expired" && "bg-destructive/10 text-destructive",
        state === "frozen" && "bg-sky-500/10 text-sky-700 dark:text-sky-300",
        state === "none" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** "Owes Rs 1,500", or "Owes money" when amounts are hidden. */
export function OwesBadge({ amount, className }: { amount: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-destructive",
        className,
      )}
    >
      {amount ? `Owes ${amount}` : "Owes money"}
    </span>
  );
}
