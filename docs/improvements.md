# Gym SaaS — Codebase Improvement & Simplification Plan

Based on a full read-only audit of the actual codebase. Every file, function, and line reference below is real.

---

## What's already solid — don't touch these

- Session check pattern across `lib/adminsessioncheck.ts`, `lib/ownersessioncheck.ts`, `lib/sessioncheck.ts` is clean and consistent. All API routes use them correctly.
- `prisma.$transaction()` is already used in the right places: `renewmembersubscription-owner.ts`, `renewsubscription.ts`, `createsubscription.ts`, `createmembersubscription-owner.ts`.
- `lib/subscription-validation.ts` — `validateOwnerSubscription` and `checkLimitExceeded` are well-structured and centralized.
- `lib/sendEmail.ts` — single export, typed attachments, used consistently everywhere.
- Email templates in `check-subscriptions.ts` are extracted at the top, not inlined in logic.
- shadcn/ui component library is complete and should not be modified.

---

## Issue 1 — Duplicated and inconsistent days-remaining logic

### What the audit found

There are two different implementations of "how many days until expiry" that produce different results:

**Version A — midnight-normalized (correct)**
Used in: `pages/api/cron/check-subscriptions.ts` (local function, lines 9–17), `pages/api/membersubscriptions/updatemembersubscription.ts` (local copy), `pages/api/membersubscriptions/updatemembersubscription-owner.ts` (local copy)

```ts
function getDaysUntilExpiration(endDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
```

**Version B — raw Date comparison (inconsistent, can differ by hours)**
Used in: `lib/subscription-helpers.ts` — `isSubscriptionExpired`, `getRemainingDays`, `calculateRemainingDaysFromEndDate`

```ts
// isSubscriptionExpired
return new Date() > endDate;

// getRemainingDays
return Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
```

The cron job and update routes use Version A. Renewal flows use Version B. The same subscription can appear expired in one flow and active in another depending on time of day.

### Fix

**Create `lib/date-utils.ts`** — delete the local copies in the three routes and replace every call with imports from this file.

```ts
// lib/date-utils.ts

/**
 * Normalizes a date to midnight local time.
 * Always use this before date comparisons to avoid hour-of-day drift.
 */
export function toMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Days until endDate from today (midnight-normalized).
 * Negative = already expired.
 * Zero = expires today.
 */
export function getDaysUntilExpiration(endDate: Date): number {
  const today = toMidnight(new Date());
  const end = toMidnight(new Date(endDate));
  return Math.ceil((end.getTime() - today.getTime()) / MS_PER_DAY);
}

/**
 * True if end_date is today or in the past (midnight-normalized).
 */
export function isExpiredOrToday(endDate: Date): boolean {
  return getDaysUntilExpiration(endDate) <= 0;
}

export const MS_PER_DAY = 1000 * 60 * 60 * 24;
```

**Update `lib/subscription-helpers.ts`** — replace the three inconsistent functions:

```ts
// DELETE these:
export function isSubscriptionExpired(endDate: Date) { ... }
export function getRemainingDays(endDate: Date) { ... }
export function calculateRemainingDaysFromEndDate(endDate: Date) { ... }

// REPLACE WITH imports from lib/date-utils.ts:
import { getDaysUntilExpiration, isExpiredOrToday } from './date-utils';
export { getDaysUntilExpiration, isExpiredOrToday };
```

**Update these files — remove local `getDaysUntilExpiration` and import from `lib/date-utils.ts`:**
- `pages/api/cron/check-subscriptions.ts` — remove lines 9–17, add import
- `pages/api/membersubscriptions/updatemembersubscription.ts` — remove local copy, add import
- `pages/api/membersubscriptions/updatemembersubscription-owner.ts` — remove local copy, add import

**Also update renewal flows** to use the same function instead of the raw Date version:
- `lib/subscription-helpers.ts` → `calculateRemainingDaysFromEndDate` should call `getDaysUntilExpiration` internally
- `pages/api/membersubscriptions/renewmembersubscription.ts`
- `pages/api/membersubscriptions/renewmembersubscription-owner.ts`
- `pages/api/subscription/renewsubscription.ts`

---

## Issue 2 — Magic numbers for reminder thresholds

### What the audit found

The values `2`, `1`, and `0` (days before expiry for first reminder, second reminder, and expiry) are hardcoded in three separate files:
- `pages/api/cron/check-subscriptions.ts`
- `pages/api/membersubscriptions/updatemembersubscription.ts`
- `pages/api/membersubscriptions/updatemembersubscription-owner.ts`

Also hardcoded: `1000 * 60 * 60 * 24` (milliseconds per day) in all three files plus `lib/subscription-helpers.ts`.

There is also dead code in `check-subscriptions.ts`: `twoDaysFromNow` and `oneDayFromNow` are computed but never used.

### Fix

**Create `lib/constants.ts`:**

```ts
// lib/constants.ts

export const REMINDER_DAYS = {
  FIRST: 2,   // Send first reminder when this many days remain
  SECOND: 1,  // Send second reminder when this many days remain
} as const;

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const CASH_PAYMENT_PREFIX = 'CASH';

export const SMTP = {
  PORT: 587,
  CONNECTION_TIMEOUT: 100_000,
  GREETING_TIMEOUT: 100_000,
} as const;

export const DASHBOARD = {
  SUBSCRIPTION_TABLE_LIMIT: 25,
  CHART_MONTHS: 12,
} as const;
```

**Update these files to import from `lib/constants.ts`:**
- `pages/api/cron/check-subscriptions.ts` — replace `daysLeft === 2`, `daysLeft === 1`, `daysLeft === 0` with `REMINDER_DAYS.FIRST`, `REMINDER_DAYS.SECOND`
- `pages/api/membersubscriptions/updatemembersubscription.ts` — same
- `pages/api/membersubscriptions/updatemembersubscription-owner.ts` — same
- `lib/sendEmail.ts` — replace `port: 587`, `connectionTimeout: 100000`, `greetingTimeout: 100000` with `SMTP.*`
- `pages/api/dashboard/owner-overview.ts` — replace `take: 25` with `DASHBOARD.SUBSCRIPTION_TABLE_LIMIT`, replace `12` with `DASHBOARD.CHART_MONTHS`

**Remove dead code in `pages/api/cron/check-subscriptions.ts`:**
- Delete `twoDaysFromNow` and `oneDayFromNow` (lines 135–139) — they are computed but never referenced.

---

## Issue 3 — Cron job has no security (publicly callable)

### What the audit found

`pages/api/cron/check-subscriptions.ts` has no session check, no secret header, and no IP restriction. Anyone who knows the URL can trigger it.

This is the most critical security issue in the codebase.

### Fix

Add a secret token check at the top of the handler, before any DB queries:

```ts
// pages/api/cron/check-subscriptions.ts
// Add as the very first check in the handler:

const cronSecret = req.headers['x-cron-secret'];
if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

Add to `.env`:
```
CRON_SECRET=your-long-random-secret-here
```

Add to `vercel.json` cron config (already exists in project):
```json
{
  "crons": [
    {
      "path": "/api/cron/check-subscriptions",
      "schedule": "0 0 * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/cron/(.*)",
      "headers": [
        {
          "key": "x-cron-secret",
          "value": "your-long-random-secret-here"
        }
      ]
    }
  ]
}
```

Update `docs/CRON_SETUP.md` to document the `CRON_SECRET` env variable.

---

## Issue 4 — Payment audit trail is missing entirely

### What the audit found

The `Payment` model has no field tracking who recorded the payment. There are 10 call sites for `prisma.payment.create()` and none of them save the logged-in user's ID:

- `pages/api/payments/createpayment.ts`
- `pages/api/subscription/renewsubscription.ts`
- `pages/api/subscription/createsubscription.ts`
- `pages/api/subscription/updatesubscription.ts`
- `pages/api/membersubscriptions/renewmembersubscription-owner.ts`
- `pages/api/membersubscriptions/renewmembersubscription.ts`
- `pages/api/membersubscriptions/createmembersubscription-owner.ts`
- `pages/api/membersubscriptions/createmembersubscription.ts`
- `pages/api/clients/createclient.ts`
- `pages/api/clients/updateclient.ts`

When a payment discrepancy is found, there is no way to know who entered it.

### Fix

**Step 1 — Update `prisma/schema.prisma`:**

```prisma
model Payment {
  id                     String              @id @default(cuid())
  owner_subscription_id  String?
  member_subscription_id String?
  subscription_type      SubscriptionTypeEnum
  amount                 Float
  payment_method         PaymentMethod
  transaction_id         String?
  payment_date           DateTime
  notes                  String?
  recorded_by_id         String?             // NEW
  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt

  ownerSubscription  OwnerSubscription?  @relation(...)
  memberSubscription MemberSubscription? @relation(...)
  recordedBy         User?               @relation("RecordedPayments", fields: [recorded_by_id], references: [id]) // NEW
}

model User {
  // ... existing fields ...
  recordedPayments  Payment[] @relation("RecordedPayments") // NEW
}
```

**Step 2 — Run migration:**
```bash
npx prisma migrate dev --name add_payment_recorded_by
npx prisma generate
```

**Step 3 — Update all 10 payment.create() call sites.**

In routes that already have a session (all of them do), add `recorded_by_id: session.user.id` to the data object.

Pattern to apply in every file listed above:

```ts
// BEFORE:
await prisma.payment.create({
  data: {
    amount,
    payment_method,
    // ...other fields
  }
});

// AFTER:
await prisma.payment.create({
  data: {
    amount,
    payment_method,
    recorded_by_id: session.user.id, // ADD THIS
    // ...other fields
  }
});
```

Note: In `pages/api/clients/createclient.ts` and `updateclient.ts`, the session is `requireSuperAdmin` — `session.user.id` is available the same way.

---

## Issue 5 — Deactivation step outside transaction in renewmembersubscription.ts

### What the audit found

In `pages/api/membersubscriptions/renewmembersubscription.ts` (Super Admin version), the previous subscription is deactivated **outside** the transaction on lines 67–70:

```ts
// Lines 67-70 — this runs BEFORE the transaction
await prisma.memberSubscription.update({
  where: { id: existingSubscription.id },
  data: { is_active: false },
});

// Then separately:
await prisma.$transaction([
  prisma.memberSubscription.create({ ... }),
  // optional payment
]);
```

If the transaction fails after the deactivation, the member is left with no active subscription.

The owner version (`renewmembersubscription-owner.ts`) does this correctly — deactivation is inside the transaction.

### Fix

In `pages/api/membersubscriptions/renewmembersubscription.ts`, move the deactivation inside the transaction:

```ts
// AFTER — everything in one transaction:
await prisma.$transaction(async (tx) => {
  // Step 1 — deactivate previous (was outside before)
  await tx.memberSubscription.update({
    where: { id: existingSubscription.id },
    data: { is_active: false },
  });

  // Step 2 — create new subscription
  const newSub = await tx.memberSubscription.create({
    data: { ... }
  });

  // Step 3 — create payment if provided
  if (amount && payment_method) {
    await tx.payment.create({
      data: {
        member_subscription_id: newSub.id,
        subscription_type: 'MEMBER',
        amount,
        payment_method,
        recorded_by_id: session.user.id,
        payment_date: payment_date ? new Date(payment_date) : new Date(),
      }
    });
  }
});
```

---

## Issue 6 — Cron job mixes concerns in one large handler

### What the audit found

`pages/api/cron/check-subscriptions.ts` is one handler that does everything:
- Fetches subscriptions
- Decides what action to take per subscription
- Writes to DB
- Sends emails
- Compiles summary and sends digest

Owner and member sections are nearly identical parallel copies (~130 lines each).

This makes it hard to test and debug. You can't check "what would happen today" without triggering real emails.

### Fix

Extract a pure decision function. Keep the handler as the executor.

**Create `lib/cron/computeActions.ts`:**

```ts
import { getDaysUntilExpiration, isExpiredOrToday } from '@/lib/date-utils';
import { REMINDER_DAYS } from '@/lib/constants';

export type CronAction =
  | { type: 'EXPIRE'; id: string; ownerEmail?: string; ownerName?: string }
  | { type: 'FIRST_REMINDER'; id: string; email: string; name: string; daysLeft: number }
  | { type: 'SECOND_REMINDER'; id: string; email: string; name: string; daysLeft: number }
  | { type: 'NONE'; id: string };

export function computeOwnerActions(subscriptions: any[]): CronAction[] {
  return subscriptions.map((sub) => {
    const daysLeft = getDaysUntilExpiration(sub.end_date);

    if (isExpiredOrToday(sub.end_date) && !sub.notification_sent) {
      return { type: 'EXPIRE', id: sub.id, ownerEmail: sub.owner.email, ownerName: sub.owner.first_name };
    }
    if (daysLeft === REMINDER_DAYS.SECOND && !sub.second_reminder_sent) {
      return { type: 'SECOND_REMINDER', id: sub.id, email: sub.owner.email, name: sub.owner.first_name, daysLeft };
    }
    if (daysLeft === REMINDER_DAYS.FIRST && !sub.first_reminder_sent) {
      return { type: 'FIRST_REMINDER', id: sub.id, email: sub.owner.email, name: sub.owner.first_name, daysLeft };
    }
    return { type: 'NONE', id: sub.id };
  });
}

export function computeMemberActions(subscriptions: any[]): CronAction[] {
  return subscriptions.map((sub) => {
    const daysLeft = getDaysUntilExpiration(sub.end_date);
    const email = sub.member?.user?.email;
    const name = sub.member?.user?.first_name;

    if (isExpiredOrToday(sub.end_date) && !sub.notification_sent) {
      return { type: 'EXPIRE', id: sub.id, ownerEmail: email, ownerName: name };
    }
    if (daysLeft === REMINDER_DAYS.SECOND && !sub.second_reminder_sent) {
      return { type: 'SECOND_REMINDER', id: sub.id, email, name, daysLeft };
    }
    if (daysLeft === REMINDER_DAYS.FIRST && !sub.first_reminder_sent) {
      return { type: 'FIRST_REMINDER', id: sub.id, email, name, daysLeft };
    }
    return { type: 'NONE', id: sub.id };
  });
}
```

**Update `pages/api/cron/check-subscriptions.ts`:**
- Remove local `getDaysUntilExpiration` and `isToday` functions
- Remove dead code: `twoDaysFromNow`, `oneDayFromNow`
- Import `computeOwnerActions`, `computeMemberActions` from `lib/cron/computeActions.ts`
- Replace the two decision loops with: `const actions = computeOwnerActions(ownerSubs)` then loop over actions by type
- Keep the email template functions and the send/DB-write executor exactly as they are — just the decision logic moves out

---

## Issue 7 — Rename typo in folder name

### What the audit found

The folder is named `contants/` (missing the 's' in constants). File: `contants/data.tsx`.

### Fix

```bash
mv contants constants
```

Update the import in every file that references `contants/data`:
```ts
// BEFORE:
import { routeItems } from '@/contants/data';

// AFTER:
import { routeItems } from '@/constants/data';
```

Search the whole project for `from '@/contants` and update all occurrences.

While you're in that file, rename it `constants/data.ts` (remove `.tsx` extension — it exports no JSX).

---

## Issue 8 — SubscriptionType enum defined but unused

### What the audit found

`prisma/schema.prisma` defines:
```prisma
enum SubscriptionType {
  MONTHLY
  YEARLY
}
```

This is never used on any model. Both `OwnerSubscription` and `MemberSubscription` use `BillingModel` (which is `MONTHLY | YEARLY`) instead. `SubscriptionType` is a dead enum.

### Fix

Delete the `SubscriptionType` enum from `schema.prisma` and run:
```bash
npx prisma migrate dev --name remove_unused_subscription_type_enum
npx prisma generate
```

Confirm no file imports or references `SubscriptionType` before deleting (search across the project).

---

## Implementation order

Do these in this exact order. Each migration step must be completed before moving to the next.

| # | Task | Files | Time |
|---|------|-------|------|
| 1 | Fix cron security — add CRON_SECRET check | `check-subscriptions.ts`, `.env`, `vercel.json` | 15 min |
| 2 | Create `lib/date-utils.ts` | new file | 20 min |
| 3 | Create `lib/constants.ts` | new file | 15 min |
| 4 | Remove local `getDaysUntilExpiration` copies | `check-subscriptions.ts`, `updatemembersubscription.ts`, `updatemembersubscription-owner.ts` | 20 min |
| 5 | Update `lib/subscription-helpers.ts` to use `date-utils` | `subscription-helpers.ts` | 15 min |
| 6 | Replace magic numbers with constants | 5 files | 20 min |
| 7 | Schema — add `recorded_by_id` to Payment | `schema.prisma` | 10 min |
| 8 | Run migration | terminal | 5 min |
| 9 | Add `recorded_by_id` to all 10 payment.create() calls | 10 files | 30 min |
| 10 | Fix deactivation outside transaction | `renewmembersubscription.ts` | 20 min |
| 11 | Create `lib/cron/computeActions.ts` | new file | 30 min |
| 12 | Refactor cron handler to use computeActions | `check-subscriptions.ts` | 30 min |
| 13 | Rename `contants/` to `constants/`, update imports | project-wide find+replace | 10 min |
| 14 | Remove dead `SubscriptionType` enum | `schema.prisma` + migration | 10 min |
| 15 | Remove dead `twoDaysFromNow`/`oneDayFromNow` in cron | `check-subscriptions.ts` | 5 min |

**Total estimated time: ~4 hours**

---

## What to verify after each step

- After step 2–5: Run the cron job manually (with the secret header) and confirm reminder emails still fire on the right days
- After step 9: Create a test payment and confirm `recorded_by_id` is populated in the DB
- After step 10: Simulate a failed transaction (throw inside) and confirm the old subscription is NOT deactivated
- After step 12: Call `computeOwnerActions` and `computeMemberActions` in isolation with mock data and confirm correct action types are returned without any DB or email calls
- After step 13: Boot the app and confirm all sidebar navigation still works

---

## Do NOT change

- `lib/adminsessioncheck.ts`, `lib/ownersessioncheck.ts`, `lib/sessioncheck.ts` — pattern is clean, leave as is
- `lib/subscription-validation.ts` — `validateOwnerSubscription` and `checkLimitExceeded` are well-structured
- All `prisma.$transaction()` usages in `renewmembersubscription-owner.ts`, `renewsubscription.ts`, `createsubscription.ts` — already correct
- `lib/sendEmail.ts` — clean single export, only update the hardcoded SMTP values to use constants
- `components/ui/` — do not touch shadcn components
