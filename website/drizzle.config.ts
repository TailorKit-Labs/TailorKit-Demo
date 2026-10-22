import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { normalizeDatabaseUrl } from "./lib/database-url.mjs";
// Deployments use credentials injected by Neon; local development uses Docker.
if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.CI) {
  config({ path: ".env.local" });
  config();
}
// The application requires DATABASE_URL even when the push uses the direct URL.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "Set DATABASE_URL in .env.local for development or connect Neon before building.",
  );
}
const url = normalizeDatabaseUrl(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
export default defineConfig({
  schema: "./lib/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url },
});
