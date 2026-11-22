# Kettlio – Gym Management Platform

Kettlio is a full-stack **gym management SaaS** that helps gym owners run members, fees and day-to-day money from one place, on desktop or phone.

Live: https://www.kettlio.com/

## ✨ Features

### 📊 Owner dashboard
- Active members, revenue this month and revenue compared with last month
- Expenses this month and profit (fees collected minus expenses)
- Charts of revenue and new members over time
- Recent payments and member subscriptions at a glance
- Filter by gym and location
- Shows the last loaded figures when the device is offline

### 👥 Members
- Add, edit and search members
- Bulk import members from an Excel/CSV file (with a downloadable template)
- Member subscriptions with start/end dates, monthly or yearly billing, and renewals
- **Freeze / unfreeze** a subscription; the end date moves forward by the frozen days
- Record why a member left (churn reason)

### 💳 Fees & payments
- Record payments by cash or bank transfer
- **Partial payments** and outstanding balances per member
- Admission fee and discounts
- PDF invoices / receipts

### 📲 Reminders & sharing
- Daily email to gym owners listing members whose fees run out soon
- Notification when members' subscriptions expire, with a downloadable PDF list
- **One-tap WhatsApp** fee reminders and receipt sharing to members
- In-app notifications and web push notifications

### 💰 Expenses & cash book
- Record expenses by category (rent, bills, salaries and more)
- Daily cash book of money in and money out
- Monthly profit

### 🏢 Gyms, locations & equipment
- Multiple gyms and locations per owner, within plan limits
- Equipment register with category, condition, usage and status
- To-do list for the gym

### 🧑‍🤝‍🧑 Staff logins
- Gym owners invite staff by email; each staff member works in one gym
- A permission page with checkboxes for what each staff member can see and do on every page (e.g. record payments but not see revenue, add members but not delete them)
- Deactivate, reactivate, resend or cancel invites
- Payments and receipts show who recorded them

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

## 🗺️ Roadmap

Not built yet. Each item has a GitHub issue:

- [Monthly report as PDF and Excel](https://github.com/developerssden/gym-saas/issues/15)
- [Record a fee in 2–3 taps and search members by phone](https://github.com/developerssden/gym-saas/issues/16)
- [Record payments and check-ins while offline, sync later](https://github.com/developerssden/gym-saas/issues/17)
- [Urdu / Roman Urdu language support](https://github.com/developerssden/gym-saas/issues/18)
- [Setup checklist and empty states for new gym owners](https://github.com/developerssden/gym-saas/issues/19)
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
npm run db:push:dev  # create the database schema
npm run seed         # create the super admin user
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

See `docs/CRON_SETUP.md` for setting up the daily cron job.

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
