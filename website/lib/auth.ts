import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { anonymous } from "better-auth/plugins/anonymous";
import { db } from "./drizzle";
import * as schema from "./schema";
import { verifyDemoSetup } from "./setup-verification";

const previewHosts = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(
  (host): host is string => Boolean(host),
);

export const auth = betterAuth({
  appName: "Forma CRM",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL:
    process.env.VERCEL_ENV === "preview" && previewHosts.length > 0
      ? { allowedHosts: previewHosts, protocol: "https" }
      : (process.env.BETTER_AUTH_URL ??
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000")),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV !== "production"
      ? "local-demo-secret-change-for-production-32"
      : undefined),
  plugins: [anonymous({ generateName: () => "Demo visitor", disableDeleteAnonymousUser: true })],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/anonymous") return;
      const failure = await verifyDemoSetup();
      if (failure) throw new APIError(failure.code, { message: failure.message });
    }),
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 30 },
});
