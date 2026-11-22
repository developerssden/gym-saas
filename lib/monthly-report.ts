// Monthly report: pure calculations from rows loaded by
// lib/monthly-report-server.ts. Kept free of Prisma so it can be tested.
//
// Money figures use the same rules as the owner dashboard: collected = member
// payments dated in the month, expenses = expenses dated in the month,
// profit = collected - expenses, outstanding = unpaid balance on subscriptions.
import { summarizeBalance } from "@/lib/member-balance";
import { expenseCategoryLabel, profit } from "@/lib/expenses";
import { churnReasonLabel } from "@/lib/churn-reasons";

export type ReportPaymentRow = {
  amount: number;
  payment_method: string;
  payment_date: Date;
};

export type ReportExpenseRow = {
  amount: number;
  category: string;
};

export type ReportSubscriptionRow = {
  id: string;
  member_id: string;
  member_name: string;
  member_phone: string | null;
  price: number;
  discount: number;
  admission_fee: number;
  billing_model: string;
  start_date: Date;
  end_date: Date;
  createdAt: Date;
  churn_reason: string | null;
  churn_note: string | null;
  payments: Array<{ amount: number; payment_date: Date }>;
};

export type MonthlyReportInput = {
  /** `YYYY-MM`. */
  month: string;
  range: { start: Date; end: Date };
  now: Date;
  /** Member payments dated in the month. */
  payments: ReportPaymentRow[];
  /** Expenses dated in the month. */
  expenses: ReportExpenseRow[];
  /** Members who joined in the month. */
  newMembers: number;
  /** Every non-deleted subscription in scope (any date). */
  subscriptions: ReportSubscriptionRow[];
};

export type ReportExpiry = {
  member_name: string;
  member_phone: string | null;
  end_date: Date;
  billing_model: string;
  price: number;
  renewed: boolean;
  /** Ended without renewal (and the end date has passed). */
  lost: boolean;
  churn_reason: string | null;
  churn_note: string | null;
};

export type MonthlyReport = {
  month: string;
  /** Human label, e.g. "November 2026". */
  monthLabel: string;
  /** True for the current month: figures are "so far". */
  isCurrentMonth: boolean;
  money: {
    collected: number;
    paymentsCount: number;
    collectedByMethod: Array<{ method: string; label: string; amount: number; count: number }>;
    expenses: number;
    expensesByCategory: Array<{ category: string; label: string; amount: number }>;
    profit: number;
    /** Unpaid balance at the end of the month (or now, for the current month). */
    outstanding: number;
    outstandingMembers: number;
  };
  members: {
    newMembers: number;
    newSubscriptions: number;
    /** Of newSubscriptions: members who already had a subscription before. */
    renewals: number;
    expiries: number;
    lost: number;
    lostByReason: Array<{ reason: string; label: string; count: number }>;
  };
  /** Subscriptions started this month, grouped by billing model and price. */
  topPlans: Array<{ label: string; billing_model: string; price: number; count: number }>;
  expiryList: ReportExpiry[];
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
};

export function billingModelLabel(value: string): string {
  if (value === "MONTHLY") return "Monthly";
  if (value === "YEARLY") return "Yearly";
  return value;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

const inRange = (d: Date, range: { start: Date; end: Date }) =>
  d.getTime() >= range.start.getTime() && d.getTime() < range.end.getTime();

export function buildMonthlyReport(input: MonthlyReportInput): MonthlyReport {
  const { range, now } = input;
  const isCurrentMonth = inRange(now, range);
  // Balances are measured at month end; for the current month that includes
  // everything recorded so far, which is what the dashboard shows.
  const cutoff = range.end;

  // Money in
  const collected = input.payments.reduce((sum, p) => sum + p.amount, 0);
  const methods = new Map<string, { amount: number; count: number }>();
  for (const p of input.payments) {
    const m = methods.get(p.payment_method) ?? { amount: 0, count: 0 };
    m.amount += p.amount;
    m.count += 1;
    methods.set(p.payment_method, m);
  }
  const collectedByMethod = [...methods.entries()]
    .map(([method, v]) => ({ method, label: METHOD_LABELS[method] ?? method, ...v }))
    .sort((a, b) => b.amount - a.amount);

  // Money out
  const expenses = input.expenses.reduce((sum, e) => sum + e.amount, 0);
  const categories = new Map<string, number>();
  for (const e of input.expenses) categories.set(e.category, (categories.get(e.category) ?? 0) + e.amount);
  const expensesByCategory = [...categories.entries()]
    .map(([category, amount]) => ({ category, label: expenseCategoryLabel(category), amount }))
    .sort((a, b) => b.amount - a.amount);

  // Outstanding at month end: subscriptions recorded by then, minus payments by then.
  let outstanding = 0;
  const owing = new Set<string>();
  for (const s of input.subscriptions) {
    if (s.createdAt.getTime() >= cutoff.getTime()) continue;
    const paid = s.payments.filter(p => p.payment_date.getTime() < cutoff.getTime());
    const { balance } = summarizeBalance(s, paid);
    if (balance > 0) {
      outstanding += balance;
      owing.add(s.member_id);
    }
  }

  // Subscriptions per member, oldest first, to spot renewals.
  const byMember = new Map<string, ReportSubscriptionRow[]>();
  for (const s of input.subscriptions) {
    const list = byMember.get(s.member_id) ?? [];
    list.push(s);
    byMember.set(s.member_id, list);
  }
  for (const list of byMember.values()) list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const hasEarlier = (s: ReportSubscriptionRow) =>
    (byMember.get(s.member_id) ?? []).some(o => o.id !== s.id && o.createdAt.getTime() < s.createdAt.getTime());
  const hasLater = (s: ReportSubscriptionRow) =>
    (byMember.get(s.member_id) ?? []).some(o => o.id !== s.id && o.createdAt.getTime() > s.createdAt.getTime());

  // New subscriptions and top plans
  const started = input.subscriptions.filter(s => inRange(s.createdAt, range));
  const renewals = started.filter(hasEarlier).length;
  const plans = new Map<string, { billing_model: string; price: number; count: number }>();
  for (const s of started) {
    const key = `${s.billing_model}|${s.price}`;
    const p = plans.get(key) ?? { billing_model: s.billing_model, price: s.price, count: 0 };
    p.count += 1;
    plans.set(key, p);
  }
  const topPlans = [...plans.values()]
    .sort((a, b) => b.count - a.count || b.price - a.price)
    .slice(0, 5)
    .map(p => ({ ...p, label: billingModelLabel(p.billing_model) }));

  // Expiries and members lost
  const expiryList: ReportExpiry[] = input.subscriptions
    .filter(s => inRange(s.end_date, range))
    .sort((a, b) => a.end_date.getTime() - b.end_date.getTime())
    .map(s => {
      const renewed = hasLater(s);
      return {
        member_name: s.member_name,
        member_phone: s.member_phone,
        end_date: s.end_date,
        billing_model: s.billing_model,
        price: s.price,
        renewed,
        lost: !renewed && s.end_date.getTime() <= now.getTime(),
        churn_reason: s.churn_reason,
        churn_note: s.churn_note,
      };
    });
  const lostRows = expiryList.filter(e => e.lost);
  const reasons = new Map<string, number>();
  for (const e of lostRows) {
    const key = e.churn_reason ?? "";
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  const lostByReason = [...reasons.entries()]
    .map(([reason, count]) => ({ reason, label: churnReasonLabel(reason || null), count }))
    .sort((a, b) => b.count - a.count);

  return {
    month: input.month,
    monthLabel: monthLabel(input.month),
    isCurrentMonth,
    money: {
      collected,
      paymentsCount: input.payments.length,
      collectedByMethod,
      expenses,
      expensesByCategory,
      profit: profit(collected, expenses),
      outstanding,
      outstandingMembers: owing.size,
    },
    members: {
      newMembers: input.newMembers,
      newSubscriptions: started.length,
      renewals,
      expiries: expiryList.length,
      lost: lostRows.length,
      lostByReason,
    },
    topPlans,
    expiryList,
  };
}
