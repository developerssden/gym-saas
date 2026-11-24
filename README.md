# Kettlio – Gym Management Platform

Kettlio is a full-stack **gym management SaaS** that helps gym owners run members, fees and day-to-day money from one place, on desktop or phone.

Live: https://www.kettlio.com/

## ✨ Features

Built phone first: every owner page works on a 375px screen, with a bottom tab bar, the current branch in the header, plain wording (no raw codes), dates like `22 Nov 2026`, and light and dark mode.

### 📊 Owner dashboard
- **Who to chase today**: members who owe money or whose membership is ending, with one-tap Record payment, Renew and WhatsApp reminder
- Active members, fees collected this month (compared with last month), outstanding fees and memberships expiring in the next 7 days
- Expenses this month and profit (fees collected minus expenses)
- Charts of revenue and new members over 6 months, 12 months or the year so far
- Shows the last loaded figures when the device is offline
- **Setup checklist** for new owners (gym, branch, members, first payment, notifications, install the app) that ticks off from real data and disappears when done

### 👥 Members
- Members list with status (Active, Expires in 3 days, Expired, Frozen) and what they owe, with filter chips: All, Active, Expiring, Expired, Owing
- Search by name or by phone number in any format (`0301…`, `+92 301…`)
- **Member profile page**: call or WhatsApp in one tap, current membership, balance and every payment with its receipt
- **Add a member, their membership and the fee in one flow**; only name and phone are required
- **Import members** from Excel/CSV in four steps, with a check of every row before importing and errors that say how to fix them
- **Freeze / unfreeze** a membership; the end date moves forward by the frozen days
- Record why a member left (churn reason)

### 🪪 Memberships
- Tabs with counts: Expiring soon, Expired, Owing, Frozen, All
- Monthly or yearly plans, custom dates, admission fee and discounts
- Renew in the last 7 days or after the membership ends; the days left are added on

### 💳 Fees & payments
- **Record a fee in 3 taps** from any page: tap "Record payment", pick the member, save. The amount is pre-filled from what they owe, or renews an ended membership and takes the fee in one step
- Cash or bank transfer, **partial payments** and outstanding balances per member
- After saving: send the receipt on WhatsApp or download the PDF
- Payments list filtered by period (today, this week, this month, chosen dates) and by cash or bank, with the total collected
- Payments and receipts show who recorded them

### 📲 Reminders & notifications
- Daily email to gym owners listing members whose fees run out soon
- Notification when members' memberships expire, with a downloadable PDF list
- **One-tap WhatsApp** fee reminders and receipt sharing to members
- In-app notifications grouped by day, and web push notifications on each device

### 💰 Expenses & cash book
- Record expenses by category (rent, bills, salaries and more), for one branch or the whole gym
- Daily cash book of money in and money out
- Monthly profit

### 📈 Reports
- Pick any month (works in every browser) and download it as **PDF** or **Excel**
- Fees collected (cash vs bank), expenses by category, profit or **loss** and unpaid fees
- New members, renewals, memberships ending, members lost and why, and top plans

### 🏋️ Equipment & to-dos
- Equipment list with condition and **maintenance due** (overdue in red, due soon in amber), added from a short form
- To-dos as a checklist: add in one line, tap to mark done (with undo), optional due dates

### ⚙️ Settings
- **My gym**: gym details, branches and plan usage on one page; several gyms and branches per owner, within plan limits
- **Profile**: your details (only name and phone required), password, notifications on this device, and **Plan & billing**
- **Subscription** page: your plan, its status and end date, how much of each limit you use, and renew on WhatsApp

### 🧑‍🤝‍🧑 Staff logins
- Gym owners invite staff by email; each staff member works in one gym
- A permission page with checkboxes for what each staff member can see and do on every page (e.g. record payments but not see revenue, add members but not delete them); the server enforces the same permissions
- Deactivate, reactivate, resend or cancel invites, with confirmations that say what will happen

### 🔐 Sign in & accounts
- **Forgot password**: a reset link by email that works once, for 1 hour, then signs you in
- Accepting an invite asks only for name, phone and a password, then signs you in and opens the dashboard

### 🛠️ Platform administration (super admin)
- Manage gym owners (clients), invite them by email and resend invites
- Manage gyms, locations, plans and owner subscriptions
- Review sign-up requests from the landing page
- Send announcements to all owners, all members or one person

### 💰 Subscription plans
Plans are managed by the super admin, not hard-coded. Each plan sets:
- Monthly and yearly price
- Maximum gyms, locations, members, equipment items and staff logins

Gym owners pay for their plan through **Polar** checkout, and the subscription is kept in sync via Polar webhooks. Current plans and prices are shown on https://www.kettlio.com/.

### 📱 Works as an app
- Installable PWA on phones and desktops
- Offline page and cached dashboard data when the connection drops
- **Record payments offline**: fees and renewals are kept on the device and sync automatically when the connection returns, without duplicates; anything the server refuses is shown for review

## 🗺️ Roadmap

Not built yet. Each item has a GitHub issue:

- [Urdu / Roman Urdu language support](https://github.com/developerssden/gym-saas/issues/18)
- [Member self-service: fee status and receipts](https://github.com/developerssden/gym-saas/issues/20)
- [Biometric attendance and entrance (paid add-on)](https://github.com/developerssden/gym-saas/issues/11)

## 🛠️ Tech stack

- **Framework:** Next.js 16, React 19, TypeScript
- **UI:** Tailwind CSS 4, shadcn/ui (Radix), TanStack Table, TanStack Query
- **Backend:** Next.js API routes, Prisma 7, PostgreSQL
- **Auth:** NextAuth
- **Billing:** Polar
- **Email & notifications:** Nodemailer (Gmail), Web Push
- **Documents:** PDFKit (invoices, reports), SheetJS (Excel import)
- **PWA:** Serwist
- **Hosting:** Vercel, with a daily cron job (`/api/cron/check-subscriptions`)

## 🚀 Getting started

```bash
npm install          # also runs prisma generate
npm run db:push:dev  # create the database schema (builds also run it, via scripts/db-deploy.mjs)
npm run db:seed      # create the super admin user
npm run dev
```

Create a `.env` file with these variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | NextAuth |
| `APP_URL` | Public URL used in emails and invite links |
| `APP_TIME_ZONE` | Time zone used for due dates and reminders |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Sending email |
| `REGISTRATION_NOTIFY_EMAIL` | Who is told about new sign-up requests |
| `CRON_SECRET` | Protects the cron endpoint |
| `POLAR_WEBHOOK_SECRET` | Verifies Polar webhooks |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push |

See `docs/CRON_SETUP.md` for setting up the daily cron job. `APP_URL` (or `NEXTAUTH_URL`) must be the real site address, because invite and password reset emails link to it.
Run the tests with `npm test` and lint with `npm run lint`.

## 📁 Project structure

```text
app/          Next.js routes (auth, dashboard, landing page)
components/   UI components
constants/    App constants, including branding (constants/brand.ts)
docs/         Project documentation
hooks/        React hooks
lib/          Business logic (billing, reminders, expenses, WhatsApp, cron…)
pages/api/    API routes
prisma/       Database schema and seed
providers/    React providers
public/       Static assets
scripts/      Database and maintenance scripts
tests/        Automated tests
```
