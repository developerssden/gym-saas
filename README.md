This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Create a `.env.local` file at the project root before running any commands. The application expects the following keys:

| Variable | Description | Example |
| --- | --- | --- |
| `DATABASE_URL` | Connection string for your Postgres database used by Prisma. | `postgresql://USER:PASSWORD@localhost:5432/gym_saas` |
| `NEXTAUTH_SECRET` | Random string used by NextAuth to sign/encrypt tokens. You can generate one with `openssl rand -base64 32`. | `your-long-random-secret` |
| `ENV` | Simple environment flag consumed in NextAuth debug mode. Use `PROD` in production to silence debug logs. | `DEV` |

> Use `.env.local` (not committed to git) or your hosting provider’s secret manager when deploying.

After updating environment variables, restart the dev server to ensure the new values are picked up.
