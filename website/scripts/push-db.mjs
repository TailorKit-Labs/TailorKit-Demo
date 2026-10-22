import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { normalizeDatabaseUrl } from "../lib/database-url.mjs";
import { isCompatiblePlan } from "./schema-plan.mjs";
import { readSchemaPlan } from "./read-schema-plan.mjs";

// Preview databases are isolated; local pushes keep Drizzle's normal workflow.
const guarded =
  process.env.VERCEL_ENV !== "preview" &&
  (process.env.VERCEL || process.env.VERCEL_ENV || process.env.CI);

if (!guarded) {
  execFileSync("drizzle-kit", ["push"], { stdio: "inherit" });
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error("Connect Neon and set DATABASE_URL before building.");
  }
  if (!process.env.DATABASE_URL_UNPOOLED) {
    throw new Error(
      "Set DATABASE_URL_UNPOOLED to a direct PostgreSQL connection before a guarded build; session advisory locks cannot use a transaction pooler.",
    );
  }
  const client = new Client({
    connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL_UNPOOLED),
  });
  await client.connect();
  try {
    // Serialize production pushes so another build cannot change the schema
    // between this dry run and the actual push.
    await client.query("SELECT pg_advisory_lock(739012345)");
    const plan = readSchemaPlan();
    if (!isCompatiblePlan(plan)) {
      console.error(JSON.stringify(plan, null, 2));
      throw new Error(
        "Production push blocked: this schema change may break the running app. Review db:plan, then explicitly apply reviewed changes with db:push:force against the intended database.",
      );
    }
    if (plan.status !== "no_changes") {
      execFileSync("drizzle-kit", ["push"], { stdio: "inherit" });
    } else {
      console.log("Database schema is already up to date.");
    }
  } finally {
    // Closing the connection also releases its advisory lock on errors.
    await client.end();
  }
}
