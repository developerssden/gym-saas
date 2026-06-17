# Category A — Dashboard UX Improvements

Based on a read-only audit of the actual codebase. Implement items in the order listed.

---

## What we are building

1. **Inline renew button on the expired member subscriptions table** — lets the gym owner renew directly from the dashboard without navigating away
2. **Owner subscription expiry banner** — warns the gym owner when their own SaaS subscription is expiring soon

Both use existing API routes. No new API routes needed. One API response needs one new field added.

---

## Important constraint found in the audit

`pages/api/dashboard/owner-overview.ts` maps expired subscription rows in a `mapSubRow` function. The rows currently expose `id` (subscription ID), `memberName`, `memberEmail`, `price`, `billingModel`, `startDate`, `endDate`, etc. — but NOT `member_id`.

The renew API (`pages/api/membersubscriptions/renewmembersubscription-owner.ts`) requires `member_id` in the POST body, not subscription ID.

**This means the first task is adding `member_id` to the dashboard API response before building any UI.**

---

## Task 1 — Add `member_id` to the owner overview response

**File:** `pages/api/dashboard/owner-overview.ts`

Find the `mapSubRow` function (or wherever subscription rows are mapped before being returned). Add `memberId` to the mapped object.

The Prisma query for `activeSubscriptions` and `expiredSubscriptions` already includes `member` (confirmed in audit). The member record has `id`.

```ts
// Find the row mapping for subscriptions — looks roughly like this:
function mapSubRow(sub: any) {
  return {
    id: sub.id,
    memberName: `${sub.member?.user?.first_name} ${sub.member?.user?.last_name}`,
    memberEmail: sub.member?.user?.email,
    price: sub.price,
    billingModel: sub.billing_model,
    startDate: sub.start_date,
    endDate: sub.end_date,
    isActive: sub.is_active,
    isExpired: sub.is_expired,
    lastPaymentAmount: sub.payments?.[0]?.amount ?? null,
    lastPaymentDate: sub.payments?.[0]?.payment_date ?? null,
    memberId: sub.member_id,   // ADD THIS LINE
  };
}
```

If `mapSubRow` is inlined rather than a named function, find both the `activeSubscriptions` and `expiredSubscriptions` mapping blocks and add `memberId: sub.member_id` to both.

No migration needed. `member_id` already exists on the `MemberSubscription` model.

---

## Task 2 — Add `memberId` to the local OwnerDashboard type

**File:** `components/dashboard/OwnerDashboard.tsx`

The component has a local type for subscription rows (part of `OwnerDashboardOverview`). Find it and add `memberId`:

```ts
// Find the subscription row type — looks roughly like:
type SubscriptionRow = {
  id: string;
  memberName: string;
  memberEmail: string;
  price: number;
  billingModel: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isExpired: boolean;
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
  memberId: string;   // ADD THIS
};
```

---

## Task 3 — Create the RenewMemberModal component

**File:** `components/dashboard/RenewMemberModal.tsx` (new file)

This is a shadcn Dialog with a single form that calls the renew API and invalidates the dashboard query on success.

```tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RenewMemberModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  defaultPrice: number;
  defaultBillingModel: string;
}

export default function RenewMemberModal({
  open,
  onClose,
  memberId,
  memberName,
  defaultPrice,
  defaultBillingModel,
}: RenewMemberModalProps) {
  const queryClient = useQueryClient();

  const [price, setPrice] = useState(defaultPrice);
  const [months, setMonths] = useState(
    defaultBillingModel === "YEARLY" ? 12 : 1
  );
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">(
    "CASH"
  );
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (paymentMethod === "BANK_TRANSFER" && !transactionId.trim()) {
      toast.error("Transaction ID is required for bank transfer");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        "/api/membersubscriptions/renewmembersubscription-owner",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_id: memberId,
            price,
            months,
            use_custom_dates: false,
            payment_method: paymentMethod,
            transaction_id: transactionId || undefined,
            notes: notes || undefined,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to renew");
      }

      toast.success(`${memberName}'s membership renewed successfully`);

      // Invalidate dashboard data so tables and counts refresh
      queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });

      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    // Reset form state on close
    setPrice(defaultPrice);
    setMonths(defaultBillingModel === "YEARLY" ? 12 : 1);
    setPaymentMethod("CASH");
    setTransactionId("");
    setNotes("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renew — {memberName}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Price */}
          <div className="grid gap-1.5">
            <Label htmlFor="price">Amount (PKR)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>

          {/* Duration */}
          <div className="grid gap-1.5">
            <Label htmlFor="months">Duration (months)</Label>
            <Input
              id="months"
              type="number"
              min={1}
              max={24}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </div>

          {/* Payment method */}
          <div className="grid gap-1.5">
            <Label>Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) =>
                setPaymentMethod(v as "CASH" | "BANK_TRANSFER")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transaction ID — only for bank transfer */}
          {paymentMethod === "BANK_TRANSFER" && (
            <div className="grid gap-1.5">
              <Label htmlFor="txn">Transaction ID</Label>
              <Input
                id="txn"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Bank reference number"
              />
            </div>
          )}

          {/* Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Processing..." : "Confirm & Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Task 4 — Add the Renew button to the expired subscriptions table

**File:** `components/dashboard/OwnerDashboard.tsx`

### Step 4a — Add modal state near the top of the component

Find where the component's state variables are declared and add:

```ts
const [renewTarget, setRenewTarget] = useState<{
  memberId: string;
  memberName: string;
  price: number;
  billingModel: string;
} | null>(null);
```

### Step 4b — Add the import at the top of the file

```ts
import RenewMemberModal from "@/components/dashboard/RenewMemberModal";
```

### Step 4c — Find the expired subscriptions DataTable

The expired subscriptions section renders a `<DataTable>` with columns defined either inline or in a local `columns` variable. Find the columns definition for the expired subscriptions table.

Add a new column as the last entry in that columns array:

```ts
{
  id: "actions",
  header: "",
  cell: ({ row }) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() =>
        setRenewTarget({
          memberId: row.original.memberId,
          memberName: row.original.memberName,
          price: row.original.price,
          billingModel: row.original.billingModel,
        })
      }
    >
      Renew
    </Button>
  ),
},
```

Make sure `Button` is already imported from `@/components/ui/button` in this file. It should already be there.

### Step 4d — Add the modal to the JSX

At the very end of the component's return statement, before the closing tag, add:

```tsx
{renewTarget && (
  <RenewMemberModal
    open={!!renewTarget}
    onClose={() => setRenewTarget(null)}
    memberId={renewTarget.memberId}
    memberName={renewTarget.memberName}
    defaultPrice={renewTarget.price}
    defaultBillingModel={renewTarget.billingModel}
  />
)}
```

---

## Task 5 — Add `subscription_end_date` to the NextAuth session

The owner's SaaS subscription expiry date is not currently in the session. The auth callback loads the active subscription from Prisma but only projects booleans. We need to add the end date.

### Step 5a — Update the auth callback

**File:** `pages/api/auth/[...nextauth].ts`

Find the `session` callback (or `jwt` callback where subscription data is attached). It currently sets something like:

```ts
token.subscription_active = ...
token.subscription_expired = ...
token.subscription_limits = ...
```

Add:
```ts
token.subscription_end_date = activeSubscription?.end_date?.toISOString() ?? null;
```

### Step 5b — Update the session type

**File:** `types/next-auth.d.ts`

Find the `interface Session` (or `User` interface inside it). Add:

```ts
subscription_end_date: string | null;
```

Also add to the `JWT` interface if it exists:

```ts
subscription_end_date: string | null;
```

### Step 5c — Pass end_date through the session callback

In `[...nextauth].ts`, find where `session.user` is built from `token`:

```ts
session.user.subscription_end_date = token.subscription_end_date as string | null;
```

---

## Task 6 — Create the OwnerSubscriptionBanner component

**File:** `components/dashboard/OwnerSubscriptionBanner.tsx` (new file)

```tsx
"use client";

import { useSession } from "next-auth/react";
import { getDaysUntilExpiration } from "@/lib/date-utils";
import { AlertTriangle, XCircle } from "lucide-react";

export default function OwnerSubscriptionBanner() {
  const { data: session } = useSession();
  const endDateStr = session?.user?.subscription_end_date;

  if (!endDateStr) return null;

  const daysLeft = getDaysUntilExpiration(new Date(endDateStr));

  // Only show when 7 days or fewer remain
  if (daysLeft > 7) return null;

  const isExpired = daysLeft <= 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium mb-4 ${
        isExpired
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-orange-300/50 bg-orange-50 text-orange-800 dark:border-orange-400/30 dark:bg-orange-950/30 dark:text-orange-300"
      }`}
    >
      {isExpired ? (
        <XCircle className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}
      <span>
        {isExpired
          ? "Your subscription has expired. Contact support to renew and restore full access."
          : `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Contact support to renew.`}
      </span>
    </div>
  );
}
```

---

## Task 7 — Add the banner to the owner dashboard

**File:** `components/dashboard/OwnerDashboard.tsx`

### Step 7a — Import the banner

```ts
import OwnerSubscriptionBanner from "@/components/dashboard/OwnerSubscriptionBanner";
```

### Step 7b — Place banner at the top of the return JSX

Find the outermost wrapper div in the return statement. The dashboard header (title + refresh button) is the first child. Add the banner just above the stat cards, immediately after the header section:

```tsx
return (
  <div className="...existing classes...">
    {/* Existing header section — title + refresh button */}
    <div className="...">...</div>

    {/* ADD THIS — subscription expiry warning */}
    <OwnerSubscriptionBanner />

    {/* Existing stat cards, charts, tables... */}
    ...
  </div>
);
```

---

## Task 8 — Verify TypeScript compiles

After all changes, run:

```bash
npx tsc --noEmit
```

Fix any type errors before considering this done. Common ones to watch for:
- `memberId` missing from the local `SubscriptionRow` type in `OwnerDashboard.tsx` — fixed in Task 2
- `subscription_end_date` not on session type — fixed in Task 5b
- `renewTarget` state type mismatch if column `row.original` doesn't match — ensure Task 2 was done first

---

## Implementation order (strict)

| # | Task | File(s) | Must come after |
|---|------|---------|-----------------|
| 1 | Add `memberId` to API response | `owner-overview.ts` | — |
| 2 | Add `memberId` to local TS type | `OwnerDashboard.tsx` | Task 1 |
| 3 | Create RenewMemberModal | new file | — |
| 4 | Add Renew button + modal to dashboard | `OwnerDashboard.tsx` | Tasks 2, 3 |
| 5 | Add `subscription_end_date` to session | `[...nextauth].ts`, `next-auth.d.ts` | — |
| 6 | Create OwnerSubscriptionBanner | new file | Task 5 |
| 7 | Add banner to dashboard | `OwnerDashboard.tsx` | Tasks 5, 6 |
| 8 | TypeScript check | terminal | All above |

---

## Do NOT change

- The renew API itself (`renewmembersubscription-owner.ts`) — it already works correctly with atomic transaction
- The `SubscriptionExpiredModal` and `SubscriptionLimitModal` — they serve a different purpose and are triggered from different pages
- The column definitions for the active subscriptions table — only the expired table gets the Renew button
- Any shadcn/ui components in `components/ui/`
- `lib/date-utils.ts` — import `getDaysUntilExpiration` from it directly, do not reimplement
