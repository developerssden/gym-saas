import { spawnSync } from "node:child_process";

// Vercel injects env vars directly; locally DATABASE_URL lives in .env, which
// is how prisma.config.ts resolves it too.
try {
  await import("dotenv/config");
} catch {
  // dotenv is a dev dependency, real env vars are enough without it.
}

if (!process.env.DATABASE_URL) {
  console.log("[db-deploy] DATABASE_URL is not set, skipping schema sync.");
  process.exit(0);
}

// Preview builds (any pushed branch) share the production database, so they
// must not change its schema: an unmerged branch's columns would land in
// production and then block main's builds. Local builds have no VERCEL_ENV and
// still sync. If Preview ever gets its own DATABASE_URL, set
// DB_PUSH_ON_PREVIEW=1 for Preview to sync it again.
const vercelEnv = process.env.VERCEL_ENV;
if (vercelEnv && vercelEnv !== "production" && process.env.DB_PUSH_ON_PREVIEW !== "1") {
  console.log(`[db-deploy] VERCEL_ENV=${vercelEnv}: skipping schema sync (production builds only).`);
  process.exit(0);
}

console.log("[db-deploy] prisma db push");

const result = spawnSync("prisma", ["db", "push"], {
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error("[db-deploy] failed to run the Prisma CLI:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
