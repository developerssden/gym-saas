---
name: audit-feature
description: Read-only audit of a Gym SaaS feature, module, route, or file. Produces a findings report only — never edits or proposes fixes. Use when the user asks to audit, review, check, or find issues (e.g. "audit the member renewal flow", "audit proxy.ts", "is the checkout flow safe to ship").
---

# Feature Audit Protocol — Gym SaaS

You are performing a **READ-ONLY audit**. Do not modify, refactor, or fix any code during this pass. Your only output is a findings report. If the user wants fixes, tell them to ask for an implementation pass separately.

Never propose code fixes or edit files when this skill runs.

## Project context (always true for this codebase)

- Next.js: **App Router** for UI, **Pages Router** for API routes.
- TypeScript, Prisma + PostgreSQL (Neon), NextAuth with JWT sessions.
- Route protection lives in **`proxy.ts`**, not `middleware.ts` — this project uses the Next.js 16 `proxy.ts` convention. APIs also enforce access via session helpers — both layers matter.
- Three roles: `SUPER_ADMIN`, `GYM_OWNER`, `MEMBER`.
- **Two separate subscription systems** — never conflate them:
  - Owner Subscriptions = platform billing (Super Admin ↔ Gym Owner), via Polar.
  - Member Subscriptions = gym membership billing (Gym Owner ↔ Member), manual cash / bank transfer, no gateway.
- Payments: Polar (Merchant of Record). Email: SendGrid. SMS: Twilio (cost-sensitive — default to email, max ~1 SMS per member per month).
- UI: shadcn/ui + tweakcn + Tailwind v4 + TanStack Query, true-black dark mode with lime green `#BDDE63` accent.

## Scope

The user will name a feature, flow, route, or file (e.g. "audit the member renewal flow" or "audit proxy.ts"). Scope the audit strictly to what's named plus its direct dependencies (types it uses, API routes it calls, Prisma models it touches). Don't wander into unrelated modules.

Report only what you actually find. Never speculate.

## Checklist

Walk every item that applies to the named scope:

1. **Role & auth enforcement** — correctly gated per role, no reachable unprotected routes. Session checked? `proxy.ts` **and** API session helpers both present where required?
2. **Plan/subscription enforcement** — creation of gyms / locations / members / equipment respects plan caps and requires an active owner subscription.
3. **Multi-tenant data isolation** — every query scoped correctly by owner / gym / location. No missing `where` that could leak another owner's data.
4. **Owner vs Member subscription correctness** — never conflated.
5. **Input validation & error handling** — server-side validation, no unhandled rejections or silent failures.
6. **Prisma/schema correctness** — N+1 queries, missing indexes on hot paths, schema/type mismatches.
7. **Email/SMS side effects** — correct triggers, SMS used sparingly, no unescaped user-controlled text interpolated into email HTML.
8. **Cron/reminder flag correctness** — reminder types don't cross-reset each other's flags; flags only set after confirmed send.
9. **Known standing issues** — flag if this feature touches:
   - `postinstall` running `prisma db push --accept-data-loss` on every Vercel build (data-loss risk)
   - SMTP configured with `rejectUnauthorized: false`
   - inline `QueryClient` instantiation blocking TanStack Query persistence
10. **UI/UX consistency** — shadcn/ui + tweakcn + true-black / lime `#BDDE63` branding.

Skip a checklist item only when it cannot apply (e.g. no email in the named flow). Say so under **Out of scope**, not by omitting it silently.

## Output format

Always produce this structure and nothing else:

```markdown
## Scope reviewed
- [files/routes actually examined]

## Findings
1. [Critical] `path:line` — one-line description of the issue and its impact
2. [Bug] `path:line` — ...
3. [Improvement] `path:line` — ...
4. [Note] `path:line` — ...

## Not an issue
- [things checked and found correct, briefly]

## Out of scope
- [anything adjacent deliberately not checked]

ready to ship / needs a fix pass / needs deeper look
```

Tags allowed on findings: `[Critical]`, `[Bug]`, `[Improvement]`, `[Note]`. Each finding needs a `file:line` reference.

Closing line must be exactly one of: `ready to ship` · `needs a fix pass` · `needs deeper look`.
