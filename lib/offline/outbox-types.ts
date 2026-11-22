// Payments waiting on this device to be sent to the server. Pure types and
// rules (tested); storage is in outbox.ts.
import type { FeeAction } from "@/lib/quick-payment";
import { phoneSearchDigits } from "@/lib/members/phone-digits";

export type OutboxItem = {
  /** Also the payment's client_id, so a resend can't create a duplicate. */
  id: string;
  kind: "payment" | "renew";
  url: string;
  body: Record<string, unknown>;
  /** Who recorded it; only synced while they're signed in. */
  userId: string;
  memberId: string;
  memberName: string;
  /** Payment only: the subscription being paid. */
  subscriptionId?: string;
  amount: number;
  method: "CASH" | "BANK_TRANSFER";
  createdAt: string;
  status: "pending" | "failed";
  error?: string;
  attempts: number;
};

export type SyncOutcome = "done" | "retry" | "failed";

/** Server errors are retried this many times before the payment is shown for review. */
export const MAX_SERVER_ERROR_ATTEMPTS = 5;

/**
 * What to do with a queued payment after trying to send it. `status` is null
 * when the request never reached the server.
 */
export function classifySyncResponse(status: number | null, attempts: number): SyncOutcome {
  if (status === null) return "retry";
  if (status >= 200 && status < 300) return "done";
  // Signed out: keep it until they sign in again.
  if (status === 401 || status === 408 || status === 429) return "retry";
  if (status >= 500) return attempts + 1 >= MAX_SERVER_ERROR_ATTEMPTS ? "failed" : "retry";
  // Refused (already paid, more than the balance, no permission...): needs a person.
  return "failed";
}

/**
 * The fee action, after taking into account payments for this member that are
 * still waiting to sync, so the same fee isn't taken twice while offline.
 */
export function applyPendingPayments(
  action: FeeAction,
  pending: Pick<OutboxItem, "kind" | "amount" | "subscriptionId" | "status">[]
): { action: FeeAction; pendingAmount: number; blockedReason: string | null } {
  const waiting = pending.filter(p => p.status === "pending");
  const pendingAmount = waiting.reduce((sum, p) => sum + p.amount, 0);
  if (waiting.some(p => p.kind === "renew")) {
    return { action, pendingAmount, blockedReason: "Already renewed on this device; waiting to sync." };
  }
  if (action.kind === "pay") {
    const paid = waiting.filter(p => p.subscriptionId === action.subscriptionId).reduce((sum, p) => sum + p.amount, 0);
    const balance = action.balance - paid;
    if (balance <= 0) {
      return { action, pendingAmount, blockedReason: "Already paid on this device; waiting to sync." };
    }
    return { action: { ...action, balance }, pendingAmount, blockedReason: null };
  }
  return { action, pendingAmount, blockedReason: null };
}

export type DirectoryMember = {
  id: string;
  name: string;
  phone: string | null;
  action: FeeAction;
};

/** Member search on the copy saved on this device (offline): name or phone in any format. */
export function searchDirectory(members: DirectoryMember[], search: string, limit = 8): DirectoryMember[] {
  const q = search.trim().toLowerCase();
  if (q.length < 2) return [];
  const digits = phoneSearchDigits(search);
  return members
    .filter(m => {
      if (m.name.toLowerCase().includes(q)) return true;
      if (!digits || !m.phone) return false;
      const phone = m.phone.replace(/\D/g, "");
      return digits.some(d => phone.includes(d));
    })
    .slice(0, limit);
}
