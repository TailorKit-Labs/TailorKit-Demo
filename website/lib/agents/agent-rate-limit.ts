import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../drizzle";
import { agentBuckets } from "../schema";

export const AGENT_TOKEN_CAPACITY = 50000;
export const AGENT_BUCKET_WINDOW_MS = 5 * 60 * 60 * 1000;
export const AGENT_TURN_RESERVATION = 10000;
export const AGENT_REQUESTS_PER_MINUTE = 5;
const LEASE_MS = 90000;

export function agentIpKey(request: Request) {
  // Vercel overwrites this header. Do not trust forwarded headers on other hosts.
  let ip =
    process.env.VERCEL === "1"
      ? request.headers.get("x-vercel-forwarded-for")?.trim()
      : process.env.NODE_ENV !== "production"
        ? "127.0.0.1"
        : undefined;
  if (!ip || !isIP(ip)) throw new Error("A trusted client IP is unavailable.");
  if (isIP(ip) === 6) ip = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV !== "production"
      ? "local-demo-secret-change-for-production-32"
      : undefined);
  if (!secret) throw new Error("The rate-limit signing secret is unavailable.");
  return createHmac("sha256", secret).update(`agent-ip:${ip}`).digest("hex");
}

export type AgentReservation = {
  key: string;
  leaseId: string;
  tokens: number;
  resetAt: Date;
};

type Admission =
  | { allowed: true; reservation: AgentReservation }
  | { allowed: false; reason: "busy" | "burst" | "budget"; retryAfter: number };

export async function reserveAgentTokens(key: string): Promise<Admission> {
  return db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .insert(agentBuckets)
      .values({
        key,
        tokens: AGENT_TOKEN_CAPACITY,
        resetAt: new Date(now.getTime() + AGENT_BUCKET_WINDOW_MS),
        requests: 0,
        requestResetAt: new Date(now.getTime() + 60000),
        leaseExpiresAt: now,
      })
      .onConflictDoNothing();
    const [bucket] = await tx
      .select()
      .from(agentBuckets)
      .where(eq(agentBuckets.key, key))
      .for("update");
    const retry = (at: Date) => Math.max(1, Math.ceil((at.getTime() - now.getTime()) / 1000));
    if (bucket.leaseId && bucket.leaseExpiresAt > now) {
      return { allowed: false, reason: "busy", retryAfter: retry(bucket.leaseExpiresAt) };
    }
    const resetAt =
      bucket.resetAt <= now ? new Date(now.getTime() + AGENT_BUCKET_WINDOW_MS) : bucket.resetAt;
    const tokens = bucket.resetAt <= now ? AGENT_TOKEN_CAPACITY : bucket.tokens;
    const requests = bucket.requestResetAt <= now ? 0 : bucket.requests;
    const requestResetAt =
      bucket.requestResetAt <= now ? new Date(now.getTime() + 60000) : bucket.requestResetAt;
    if (requests >= AGENT_REQUESTS_PER_MINUTE) {
      return { allowed: false, reason: "burst", retryAfter: retry(requestResetAt) };
    }
    if (tokens < AGENT_TURN_RESERVATION) {
      return { allowed: false, reason: "budget", retryAfter: retry(resetAt) };
    }
    const reservation = { key, leaseId: randomUUID(), tokens: AGENT_TURN_RESERVATION, resetAt };
    await tx
      .update(agentBuckets)
      .set({
        tokens: tokens - reservation.tokens,
        resetAt,
        requests: requests + 1,
        requestResetAt,
        leaseId: reservation.leaseId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      })
      .where(eq(agentBuckets.key, key));
    return { allowed: true, reservation };
  });
}

export async function settleAgentTokens(reservation: AgentReservation, usage?: number) {
  // Missing/partial usage (including cancellation) keeps the full reservation charged.
  const charged =
    usage != null && Number.isFinite(usage) && usage >= 0 ? Math.ceil(usage) : reservation.tokens;
  await db
    .update(agentBuckets)
    .set({
      tokens: sql`greatest(0, least(${AGENT_TOKEN_CAPACITY}, ${agentBuckets.tokens} + ${reservation.tokens - charged}))`,
      leaseId: null,
      leaseExpiresAt: new Date(),
    })
    .where(
      and(
        eq(agentBuckets.key, reservation.key),
        eq(agentBuckets.leaseId, reservation.leaseId),
        eq(agentBuckets.resetAt, reservation.resetAt),
      ),
    );
}

export async function pruneAgentBuckets() {
  // Bounded cleanup after requests; expired reservations have already been charged.
  const now = new Date();
  await db
    .delete(agentBuckets)
    .where(
      and(
        lt(agentBuckets.resetAt, now),
        lt(agentBuckets.leaseExpiresAt, now),
        sql`${agentBuckets.key} in (select key from agent_buckets where reset_at < ${now} and lease_expires_at < ${now} order by reset_at limit 100)`,
      ),
    );
}
