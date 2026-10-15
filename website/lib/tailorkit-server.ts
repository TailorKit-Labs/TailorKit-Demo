import { createServer } from "tailorkit/server";
import { revalidatePath } from "next/cache";
import { createTailorKitServerTools } from "./tailorkit-server-tools";
import { contract } from "./tailorkit";

const origin =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.BETTER_AUTH_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"));

export const tailorKit = createServer({
  contract,
  tools: createTailorKitServerTools(() => revalidatePath("/", "layout")),
  projectKey: process.env.TAILORKIT_PROJECT_KEY,
  baseUrl: new URL("/api/tailorkit", origin),
});
