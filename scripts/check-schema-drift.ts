/**
 * Manual schema drift check. Not used in CI.
 *
 *   npx tsx scripts/check-schema-drift.ts
 *
 * Uses DATABASE_URL from the environment / .env (same as prisma.config.ts).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import "dotenv/config";
import prisma from "../lib/prisma";

function modelsFromSchema(): string[] {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  const schema = readFileSync(schemaPath, "utf8");
  const names: string[] = [];
  for (const match of schema.matchAll(/^model\s+(\w+)\s+\{/gm)) {
    names.push(match[1]);
  }
  return names.sort();
}

async function tablesFromDatabase(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY 1
  `;
  return rows.map((row) => row.table_name);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[check-schema-drift] DATABASE_URL is not set.");
    process.exit(1);
  }

  const models = modelsFromSchema();
  const tables = await tablesFromDatabase();
  const tableSet = new Set(tables);
  const modelSet = new Set(models);

  const missingTables = models.filter((name) => !tableSet.has(name));
  const extraTables = tables.filter((name) => !modelSet.has(name));

  console.log(`[check-schema-drift] models in schema.prisma: ${models.length}`);
  console.log(`[check-schema-drift] public tables: ${tables.length}`);

  if (missingTables.length === 0) {
    console.log("Models with no matching table: none");
  } else {
    console.log("Models with no matching table:");
    for (const name of missingTables) {
      console.log(`  - ${name}`);
    }
  }

  if (extraTables.length === 0) {
    console.log("Tables with no matching model: none");
  } else {
    console.log("Tables with no matching model:");
    for (const name of extraTables) {
      console.log(`  - ${name}`);
    }
  }

  if (missingTables.length > 0) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("[check-schema-drift] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
