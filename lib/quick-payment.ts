// Quick "Record payment": works out what a member should pay right now, so the
// owner only picks the member and taps Save.
import { amountDue, summarizeBalance } from "@/lib/member-balance";

export type QuickSubscription = {
  id: string;
  price: number;
  discount: number;
  admission_fee: number;
  billing_model: string;
  end_date: Date | string;
  is_active: boolean;
  is_expired: boolean;
  createdAt: Date | string;
  payments: Array<{ amount: number }>;
};

export type FeeAction =
  /** Collect what's still owed on a subscription. */
  | { kind: "pay"; subscriptionId: string; balance: number; amountDue: number; endDate: string; billingModel: string }
  /** Last subscription has ended and is paid: renew it on the same terms and collect the fee. */
  | {
      kind: "renew";
      price: number;
      discount: number;
      months: number;
      billingModel: string;
      amountDue: number;
      endedOn: string;
    }
  /** Current subscription is paid up. */
  | { kind: "paid"; paidUntil: string }
  /** Member has no subscription yet. */
  | { kind: "none" };

const time = (d: Date | string) => new Date(d).getTime();
const iso = (d: Date | string) => new Date(d).toISOString();

export function monthsForBillingModel(billingModel: string): number {
  return billingModel === "YEARLY" ? 12 : 1;
}

export function decideFeeAction(subscriptions: QuickSubscription[]): FeeAction {
  const newestFirst = [...subscriptions].sort((a, b) => time(b.createdAt) - time(a.createdAt));

  // Money owed comes first, newest subscription first.
  for (const s of newestFirst) {
    const { balance, amount_due } = summarizeBalance(s, s.payments);
    if (balance > 0) {
      return {
        kind: "pay",
        subscriptionId: s.id,
        balance,
        amountDue: amount_due,
        endDate: iso(s.end_date),
        billingModel: s.billing_model,
      };
    }
  }

  const latest = newestFirst[0];
  if (!latest) return { kind: "none" };

  // Same rule as the renew API: only once the current one has expired or been ended.
  if (latest.is_active && !latest.is_expired) return { kind: "paid", paidUntil: iso(latest.end_date) };

  const fee = { price: latest.price, discount: latest.discount, admission_fee: 0 };
  return {
    kind: "renew",
    price: latest.price,
    discount: latest.discount,
    months: monthsForBillingModel(latest.billing_model),
    billingModel: latest.billing_model,
    amountDue: amountDue(fee),
    endedOn: iso(latest.end_date),
  };
}
