import { createServer } from "tailorkit/server";
import { contract } from "./tailorkit";

const host =
  process.env.VERCEL_ENV === "production"
    ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL)
    : process.env.VERCEL_URL;
const origin = host ? `https://${host}` : `http://localhost:${process.env.PORT ?? "3000"}`;

export const tailorKit = createServer({
  contract,
  projectKey: process.env.TAILORKIT_PROJECT_KEY,
  baseUrl: new URL("/api/tailorkit", origin),
});
