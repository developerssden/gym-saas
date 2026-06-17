# Category C — Route Protection + Member Role Routing

Based on a read-only audit of the actual codebase. Implement tasks in the strict order listed.

---

## What we are building

1. **Extend the proxy route gates** — `proxy.ts` is already the correct filename for Next.js 16 middleware and is already running. It is simply missing several gym owner routes that are currently unprotected.
2. **Fix the MEMBER login flow** — members currently land on a broken owner dashboard; redirect them to `/unauthorized` with a clear message until a member portal exists.
3. **Fix the dashboard page** — handle the MEMBER role explicitly so it never falls through to OwnerDashboard.

These are all pre-scale requirements. None of this is visible to gym owners in normal use, but without it: unauthenticated users can load several dashboard routes, members get a broken experience, and GYM_OWNER users can briefly access SuperAdmin pages before the client-side redirect fires.

---

## Important — do not rename proxy.ts

In Next.js 16, the middleware file is correctly named `proxy.ts`. Do not rename it to `middleware.ts`. The file is already active and running. The only problem is that the route gates inside it are incomplete.

---

## What already works — do not change

- `proxy.ts` — the `matchesPath`, `isPublic`, `findGate`, `withAuth` wrapper, and `config.matcher` are all correct. Only the `ROUTE_GATES` array needs extending.
- All API routes are already protected server-side via `requireSuperAdmin`, `requireGymOwner`, `requireAdminOrOwner`. Those stay exactly as they are.
- The client-side page guards on SuperAdmin pages (`useSession({ required: true })` + role check) stay as they are — they become a redundant second layer, which is fine.
- `lib/adminsessioncheck.ts`, `lib/ownersessioncheck.ts`, `lib/sessioncheck.ts` — do not touch.

---

## Task 1 — Extend the proxy route gates

**File:** `proxy.ts`

The current `ROUTE_GATES` array protects `/dashboard`, `/clients`, `/subscriptions`, `/plans`, `/payments`, `/announcements` — but leaves these routes completely unprotected:

- `/members`
- `/membersubscriptions`
- `/equipment`
- `/todos`
- `/gyms`
- `/locations`
- `/profile`

Replace the `ROUTE_GATES` array with the complete version. Touch nothing else in the file:

```ts
const ROUTE_GATES: RouteGate[] = [
  {
    routes: ['/dashboard'],
    roles: ['SUPER_ADMIN', 'GYM_OWNER'],
  },
  {
    routes: ['/clients', '/subscriptions', '/plans'],
    roles: ['SUPER_ADMIN'],
  },
  {
    routes: ['/gyms', '/locations', '/payments', '/announcements'],
    roles: ['SUPER_ADMIN', 'GYM_OWNER'],
  },
  {
    routes: ['/members', '/membersubscriptions', '/equipment', '/todos', '/profile'],
    roles: ['GYM_OWNER'],
  },
];
```

**What this achieves:**
- Unauthenticated users hitting any of these routes get redirected to `/sign-in` at the edge before the page renders
- A MEMBER hitting any of these routes gets redirected to `/unauthorized` at the edge
- A GYM_OWNER hitting `/clients`, `/subscriptions`, or `/plans` gets redirected to `/unauthorized` at the edge

---

## Task 2 — Fix the dashboard page to handle MEMBER role

**File:** `app/(dashboard)/dashboard/page.tsx`

Current code routes everything non-SuperAdmin to `OwnerDashboard`, including MEMBERs:

```ts
// CURRENT — broken for MEMBER
{role === "SUPER_ADMIN" ? <AdminDashboard /> : <OwnerDashboard />}
```

Replace the full page with this:

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import OwnerDashboard from '@/components/dashboard/OwnerDashboard';
import FullScreenLoader from '@/components/common/FullScreenLoader';

const DashboardPage = () => {
  const { data: session, status } = useSession({ required: true });

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  const role = session?.user?.role;

  if (role === 'SUPER_ADMIN') {
    return <AdminDashboard />;
  }

  if (role === 'GYM_OWNER') {
    return <OwnerDashboard />;
  }

  // MEMBER or any unrecognised role — proxy.ts should have caught this
  // at the edge, but this is the client-side safety net
  redirect('/unauthorized');
};

export default DashboardPage;
```

Two changes from the current version:
1. Added `required: true` to `useSession` — unauthenticated users are forced to sign-in
2. Explicit `GYM_OWNER` and `MEMBER` branches — nothing falls through to OwnerDashboard by default

---

## Task 3 — Fix the post-login redirect for MEMBER role

**File:** `components/forms/login-form.tsx`

Read this file fully before making any changes. Currently on successful login every role is pushed to `/dashboard`:

```ts
// CURRENT — same redirect for all roles
router.push('/dashboard');
```

The safest pattern for the existing NextAuth credentials setup is to call `getSession()` after `signIn()` succeeds to read the role, then branch:

```ts
import { signIn, getSession } from 'next-auth/react';

// After signIn() returns successfully:
const updatedSession = await getSession();
const userRole = updatedSession?.user?.role;

if (userRole === 'SUPER_ADMIN' || userRole === 'GYM_OWNER') {
  router.push('/dashboard');
} else {
  // MEMBER or unknown role — no portal yet
  router.push('/unauthorized');
}
```

**Do not change the `signIn()` call itself** — only change what happens after it succeeds. If the form already reads the session result differently, adapt the branch logic to whatever pattern is already there rather than replacing it wholesale.

---

## Task 4 — Improve the unauthorized page

**File:** `app/(dashboard)/unauthorized/page.tsx`

Read the current contents first. Members will now land here — the page should explain the situation clearly rather than showing a generic access-denied message.

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

export default function UnauthorizedPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isMember = session?.user?.role === 'MEMBER';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <ShieldX className="h-12 w-12 text-muted-foreground" />

      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isMember ? 'Member portal coming soon' : 'Access denied'}
        </h1>
        <p className="text-muted-foreground max-w-sm">
          {isMember
            ? 'This app is currently for gym owners. A member portal is on the way. Contact your gym for membership information.'
            : 'You do not have permission to access this page.'}
        </p>
      </div>

      <Button variant="outline" onClick={() => router.push('/sign-in')}>
        Back to sign in
      </Button>
    </div>
  );
}
```

---

## Task 5 — TypeScript check

```bash
npx tsc --noEmit
```

Things to watch for:
- `getSession` import in `login-form.tsx` — must come from `next-auth/react`, not `next-auth`
- `redirect` in `dashboard/page.tsx` — imported from `next/navigation`, already used elsewhere in this project

---

## Implementation order (strict)

| # | Task | File(s) | Must come after |
|---|------|---------|-----------------| 
| 1 | Extend ROUTE_GATES | `proxy.ts` | — |
| 2 | Fix dashboard MEMBER handling | `app/(dashboard)/dashboard/page.tsx` | — |
| 3 | Fix post-login redirect | `components/forms/login-form.tsx` | Task 2 |
| 4 | Improve unauthorized page | `app/(dashboard)/unauthorized/page.tsx` | — |
| 5 | TypeScript check | terminal | All above |

---

## Testing checklist — verify these manually after implementation

- [ ] Unauthenticated user visits `/dashboard` → redirected to `/sign-in` (check Network tab — should be a `302` response, not a page render followed by client redirect)
- [ ] Unauthenticated user visits `/members` → redirected to `/sign-in`
- [ ] Unauthenticated user visits `/equipment` → redirected to `/sign-in`
- [ ] GYM_OWNER visits `/clients` → redirected to `/unauthorized`
- [ ] GYM_OWNER visits `/plans` → redirected to `/unauthorized`
- [ ] GYM_OWNER visits `/members` → loads correctly
- [ ] GYM_OWNER visits `/membersubscriptions` → loads correctly
- [ ] SUPER_ADMIN visits `/dashboard` → AdminDashboard renders
- [ ] GYM_OWNER visits `/dashboard` → OwnerDashboard renders
- [ ] MEMBER logs in → lands on `/unauthorized` with "Member portal coming soon" message, not a broken dashboard
- [ ] MEMBER visits `/members` directly → `302` redirect to `/unauthorized` at the edge (visible in Network tab before any page JS runs)

---

## Do NOT change

- `proxy.ts` — anything outside the `ROUTE_GATES` array
- Any API route session helpers (`requireSuperAdmin`, `requireGymOwner`, `requireAdminOrOwner`)
- The client-side role checks on SuperAdmin pages — they stay as a second layer
- `constants/data.ts` route permissions — sidebar filtering already works correctly
- `components/layout/app-sidebar.tsx` — already filters by role correctly
- NextAuth configuration in `pages/api/auth/[...nextauth].ts`
- Any existing `SubscriptionExpiredModal` or `SubscriptionLimitModal` behaviour
