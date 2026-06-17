# Category B — Demo Polish: Combined Renewal UI + Churn Reason Capture

Based on a read-only audit of the actual codebase. Implement tasks in the strict order listed.

---

## What we are building

1. **Renew action on the member subscriptions list page** — adds a Renew option to the row actions dropdown, opening a Dialog that combines renewal + payment recording in one step (same pattern as the dashboard's RenewMemberModal, but accessible from /membersubscriptions)
2. **Churn reason capture** — schema field + API route + a lightweight modal that appears when a gym owner views an expired subscription, asking why the member left

The backend already handles both correctly. This is purely UI + one schema addition.

---

## What already exists (do not rebuild)

- `components/dashboard/RenewMemberModal.tsx` — already built in Category A. We will **reuse** this component, not duplicate it.
- `pages/api/membersubscriptions/renewmembersubscription-owner.ts` — already handles renew + payment atomically.
- The delete AlertDialog pattern in `components/membersubscriptions/columns.tsx` — use this as the model for adding a new row action.
- `pages/api/membersubscriptions/updatemembersubscription-owner.ts` — already exists, we will add churn fields to it.

---

## Task 1 — Add churn fields to the Prisma schema

**File:** `prisma/schema.prisma`

Add two fields to `MemberSubscription` after `is_deleted` and before `createdAt`:

```prisma
model MemberSubscription {
  id                   String       @id @default(uuid())
  member_id            String
  price                Int
  billing_model        BillingModel
  start_date           DateTime
  end_date             DateTime
  is_expired           Boolean      @default(false)
  notification_sent    Boolean      @default(false)
  first_reminder_sent  Boolean      @default(false)
  second_reminder_sent Boolean      @default(false)
  is_active            Boolean      @default(true)
  is_deleted           Boolean      @default(false)
  churn_reason         String?      // ADD — nullable, free-text category
  churn_note           String?      // ADD — nullable, optional extra detail
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt

  // Relations
  member   Member    @relation(fields: [member_id], references: [id])
  payments Payment[]
}
```

Using `String?` instead of an enum keeps the schema simple — the UI will constrain the values via a Select, and we avoid a migration every time a churn reason label changes.

**Run migration:**
```bash
npx prisma migrate dev --name add_churn_fields_to_member_subscription
npx prisma generate
```

---

## Task 2 — Add a churn API route

**File:** `pages/api/membersubscriptions/recordchurnreason.ts` (new file)

Gym owner only. Receives subscription ID + reason + optional note, writes to DB.

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireGymOwner } from "@/lib/ownersessioncheck";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await requireGymOwner(req, res);
  if (!session) return;

  const { id, churn_reason, churn_note } = req.body;

  if (!id || !churn_reason) {
    return res.status(400).json({ message: "id and churn_reason are required" });
  }

  // Verify the subscription belongs to a member in this owner's gym
  const subscription = await prisma.memberSubscription.findFirst({
    where: {
      id,
      is_deleted: false,
      member: {
        gym: {
          owner_id: session.user.id,
        },
      },
    },
  });

  if (!subscription) {
    return res.status(404).json({ message: "Subscription not found" });
  }

  const updated = await prisma.memberSubscription.update({
    where: { id },
    data: {
      churn_reason: churn_reason.trim(),
      churn_note: churn_note?.trim() ?? null,
    },
  });

  return res.status(200).json({ message: "Churn reason recorded", data: updated });
}
```

---

## Task 3 — Create the ChurnReasonModal component

**File:** `components/membersubscriptions/ChurnReasonModal.tsx` (new file)

A lightweight Dialog that appears after viewing an expired subscription. The gym owner can fill it in or skip it.

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHURN_REASONS = [
  { value: "TOO_EXPENSIVE", label: "Too expensive" },
  { value: "STOPPED_COMING", label: "Stopped coming" },
  { value: "MOVED", label: "Moved away" },
  { value: "SWITCHED_GYM", label: "Switched to another gym" },
  { value: "MEDICAL", label: "Medical / health reasons" },
  { value: "OTHER", label: "Other" },
];

interface ChurnReasonModalProps {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
  memberName: string;
}

export default function ChurnReasonModal({
  open,
  onClose,
  subscriptionId,
  memberName,
}: ChurnReasonModalProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        "/api/membersubscriptions/recordchurnreason",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: subscriptionId,
            churn_reason: reason,
            churn_note: note || null,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to record");
      }

      toast.success("Churn reason saved");
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setReason("");
    setNote("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why did {memberName} leave?</DialogTitle>
          <DialogDescription>
            This helps you understand your retention. You can skip this.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {CHURN_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="churn-note">
              Additional note{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="churn-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any extra detail…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || loading}>
            {loading ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Task 4 — Add Renew and Churn actions to the member subscriptions columns

**File:** `components/membersubscriptions/columns.tsx`

This is the main change in Category B. The columns file currently has Edit and Delete in the actions dropdown. We add Renew (for any subscription) and Record Churn Reason (for expired subscriptions only).

### Step 4a — Add imports at the top of columns.tsx

```ts
import { useState } from "react";
import RenewMemberModal from "@/components/dashboard/RenewMemberModal";
import ChurnReasonModal from "@/components/membersubscriptions/ChurnReasonModal";
```

### Step 4b — The columns array uses a function pattern or a plain array

The actions cell in columns.tsx currently uses an inline component to hold delete state. We need to extend it to also hold renew and churn modal state.

Find the actions column — it looks roughly like this:

```ts
// CURRENT actions column (approximate)
{
  id: "actions",
  cell: ({ row }) => {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const subscription = row.original;
    // ... delete mutation
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">...</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <Link href={`/membersubscriptions/manage?action=edit&id=${subscription.id}`}>
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog open={showDeleteDialog}>...</AlertDialog>
      </>
    );
  }
}
```

Replace the entire actions column cell with the following:

```ts
{
  id: "actions",
  cell: ({ row }) => {
    const subscription = row.original;
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [showChurnModal, setShowChurnModal] = useState(false);

    // Keep the existing delete mutation exactly as it is — do not change it
    // [existing deleteMutation code stays here unchanged]

    const memberName =
      `${subscription.member?.user?.first_name ?? ""} ${subscription.member?.user?.last_name ?? ""}`.trim() ||
      "Member";

    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Existing Edit link — do not change */}
            <DropdownMenuItem asChild>
              <Link
                href={`/membersubscriptions/manage?action=edit&id=${subscription.id}`}
              >
                Edit
              </Link>
            </DropdownMenuItem>

            {/* NEW — Renew */}
            <DropdownMenuItem onClick={() => setShowRenewModal(true)}>
              Renew
            </DropdownMenuItem>

            {/* NEW — Record Churn Reason, only shown for expired subscriptions */}
            {subscription.is_expired && (
              <DropdownMenuItem onClick={() => setShowChurnModal(true)}>
                Record why they left
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Existing Delete — do not change */}
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Existing delete AlertDialog — do not change */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          {/* ... existing delete dialog content unchanged ... */}
        </AlertDialog>

        {/* NEW — Renew modal */}
        {showRenewModal && (
          <RenewMemberModal
            open={showRenewModal}
            onClose={() => setShowRenewModal(false)}
            memberId={subscription.member_id}
            memberName={memberName}
            defaultPrice={subscription.price}
            defaultBillingModel={subscription.billing_model}
          />
        )}

        {/* NEW — Churn reason modal */}
        {showChurnModal && (
          <ChurnReasonModal
            open={showChurnModal}
            onClose={() => setShowChurnModal(false)}
            subscriptionId={subscription.id}
            memberName={memberName}
          />
        )}
      </>
    );
  },
},
```

### Step 4c — Add missing imports to columns.tsx if not already present

Check the top of the file and add any that are missing:

```ts
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

### Step 4d — Verify RenewMemberModal query invalidation covers the list page

**File:** `components/dashboard/RenewMemberModal.tsx`

The existing RenewMemberModal only invalidates `["ownerDashboardOverview"]` on success. When opened from the member subscriptions list page, we also need to invalidate the list query so the row updates.

Find the `queryClient.invalidateQueries` call in RenewMemberModal and add a second invalidation:

```ts
// BEFORE (existing):
queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });

// AFTER — invalidate both:
queryClient.invalidateQueries({ queryKey: ["ownerDashboardOverview"] });
queryClient.invalidateQueries({ queryKey: ["membersubscriptions"] });
```

The `["membersubscriptions"]` prefix invalidation will match all keys starting with that string (list page uses `["membersubscriptions", page, limit, filter]`).

---

## Task 5 — Add churn_reason to the MemberSubscription TypeScript type

**File:** `types/index.ts`

Find the `MemberSubscription` type and add the two new fields:

```ts
export type MemberSubscription = {
  id: string;
  member_id: string;
  price: number;
  billing_model: BillingModel;
  start_date: string;
  end_date: string;
  is_expired: boolean;
  notification_sent: boolean;
  is_active: boolean;
  is_deleted: boolean;
  churn_reason: string | null;  // ADD
  churn_note: string | null;    // ADD
  createdAt: string;
  updatedAt: string;
  member?: any;
  payments?: Payment[];
};
```

---

## Task 6 — TypeScript check

```bash
npx tsc --noEmit
```

Common errors to watch for:
- `subscription.member_id` not on the row type in columns.tsx — the Prisma response includes it; if the local type doesn't, add it to `MemberSubscription` in `types/index.ts`
- `subscription.member?.user?.first_name` — member is typed `any` in the current type definition, so this should pass without change
- `churn_reason` / `churn_note` not on `MemberSubscription` type — fixed in Task 5

---

## Implementation order (strict)

| # | Task | File(s) | Must come after |
|---|------|---------|-----------------|
| 1 | Schema — add churn fields | `schema.prisma` | — |
| 2 | Run migration + generate | terminal | Task 1 |
| 3 | Create churn API route | `pages/api/membersubscriptions/recordchurnreason.ts` | Task 2 |
| 4 | Create ChurnReasonModal | `components/membersubscriptions/ChurnReasonModal.tsx` | Task 3 |
| 5 | Update RenewMemberModal to also invalidate list query | `components/dashboard/RenewMemberModal.tsx` | — |
| 6 | Add Renew + Churn actions to columns | `components/membersubscriptions/columns.tsx` | Tasks 4, 5 |
| 7 | Add churn fields to TS type | `types/index.ts` | Task 2 |
| 8 | TypeScript check | terminal | All above |

---

## Do NOT change

- `pages/api/membersubscriptions/renewmembersubscription-owner.ts` — already correct
- `pages/api/membersubscriptions/updatemembersubscription-owner.ts` — churn is a separate route, not bolted onto update
- `components/dashboard/RenewMemberModal.tsx` — only change is the added `invalidateQueries` line in Task 4d
- `app/(dashboard)/membersubscriptions/manage/page.tsx` — the create/edit page is not part of this category
- The existing delete AlertDialog in columns.tsx — preserve it exactly, only extend the surrounding structure
- Any shadcn/ui components in `components/ui/`
- Super Admin subscription columns at `components/SuperAdmin/subscription/` — gym owner and Super Admin flows stay separate
