import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { normalizeDatabaseUrl } from "./database-url.mjs";

const globalDb = globalThis as unknown as { crmPool?: Pool };
export const pool =
  globalDb.crmPool ??
  new Pool({
    connectionString: normalizeDatabaseUrl(
      process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5432/crm",
    ),
    max: 5,
  });
if (process.env.NODE_ENV !== "production") globalDb.crmPool = pool;
export const db = drizzle({ client: pool });
