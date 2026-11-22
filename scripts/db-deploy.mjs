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

// Output is captured (and printed as-is) so a data-loss stop can be explained.
const result = spawnSync("prisma", ["db", "push"], {
  shell: true,
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"],
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  console.error("[db-deploy] failed to run the Prisma CLI:", result.error);
  process.exit(1);
}

// The build never accepts data loss on its own. Say what to do instead.
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
if (result.status !== 0 && output.includes("--accept-data-loss")) {
  const target = vercelEnv ? "production" : "this";
  console.error(`
[db-deploy] Schema sync stopped: Prisma warned (above) that the changes might lose data.
[db-deploy] Nothing was changed in ${target === "production" ? "the production database" : "this database"}.
[db-deploy]
[db-deploy] Read each warning above:
[db-deploy]  - Safe, e.g. a unique constraint on a NEW column (every row is empty, so there can't be
[db-deploy]    duplicates): apply it once by hand, then redeploy:
[db-deploy]      DATABASE_URL="<${target} database URL>" npx prisma db push --accept-data-loss
[db-deploy]  - Real data loss, e.g. dropping a column or enum value that has data: don't accept it.
[db-deploy]    Usually the database has columns that main's schema doesn't (for example from an
[db-deploy]    unmerged branch); merge that branch or update prisma/schema.prisma instead.
`);
}

process.exit(result.status ?? 1);
