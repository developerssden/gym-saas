import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Vercel injects env vars directly; locally DATABASE_URL lives in .env, which
// is how prisma.config.ts resolves it too.
try {
  await import("dotenv/config");
} catch {
  // dotenv is a dev dependency, real env vars are enough without it.
}

const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

function hasMigrations() {
  if (!existsSync(migrationsDir)) return false;
  return readdirSync(migrationsDir, { withFileTypes: true }).some(
    (entry) => entry.isDirectory()
  );
}

if (!process.env.DATABASE_URL) {
  console.log("[db-deploy] DATABASE_URL is not set, skipping schema sync.");
  process.exit(0);
}

// Once a migrations folder exists, deploy it; until then keep the
// `db push` workflow this project has always used.
const args = hasMigrations() ? ["migrate", "deploy"] : ["db", "push"];

console.log(`[db-deploy] prisma ${args.join(" ")}`);

const result = spawnSync("prisma", args, { stdio: "inherit", shell: true });

if (result.error) {
  console.error("[db-deploy] failed to run the Prisma CLI:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
