import "./test-env";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../lib/drizzle";
import { agentBuckets } from "../lib/schema";
import {
  AGENT_TOKEN_CAPACITY,
  AGENT_TURN_RESERVATION,
  AGENT_REQUESTS_PER_MINUTE,
  AGENT_BUCKET_WINDOW_MS,
  agentIpKey,
  reserveAgentTokens,
  settleAgentTokens,
  pruneAgentBuckets,
} from "../lib/agents/agent-rate-limit";

async function main() {
  const keys: string[] = [];
  const key = () => {
    const value = `rate-test-${crypto.randomUUID()}`;
    keys.push(value);
    return value;
  };
  const row = async (value: string) =>
    (await db.select().from(agentBuckets).where(eq(agentBuckets.key, value)))[0];
  try {
    const bucketKey = key();
    const raced = await Promise.all(Array.from({ length: 8 }, () => reserveAgentTokens(bucketKey)));
    const admitted = raced.filter((result) => result.allowed);
    assert.equal(admitted.length, 1, "Concurrent requests must share one IP lease");
    assert.ok(
      raced
        .filter((result) => !result.allowed)
        .every((result) => !result.allowed && result.reason === "busy"),
    );
    const first = admitted[0];
    assert.ok(first.allowed);
    assert.equal((await row(bucketKey)).tokens, AGENT_TOKEN_CAPACITY - AGENT_TURN_RESERVATION);
    await settleAgentTokens(first.reservation, 2300);
    assert.equal((await row(bucketKey)).tokens, AGENT_TOKEN_CAPACITY - 2300);
    await settleAgentTokens(first.reservation, 0);
    assert.equal(
      (await row(bucketKey)).tokens,
      AGENT_TOKEN_CAPACITY - 2300,
      "Settlement must be idempotent",
    );

    for (let index = 1; index < AGENT_REQUESTS_PER_MINUTE; index++) {
      const next = await reserveAgentTokens(bucketKey);
      assert.ok(next.allowed);
      await settleAgentTokens(next.reservation, 100);
    }
    const burst = await reserveAgentTokens(bucketKey);
    assert.ok(
      !burst.allowed && burst.reason === "burst" && burst.retryAfter > 0 && burst.retryAfter <= 60,
    );
    await db
      .update(agentBuckets)
      .set({ requestResetAt: new Date(0) })
      .where(eq(agentBuckets.key, bucketKey));
    const afterMinute = await reserveAgentTokens(bucketKey);
    assert.ok(afterMinute.allowed);
    const beforeFailure = (await row(bucketKey)).tokens;
    await settleAgentTokens(afterMinute.reservation);
    assert.equal(
      (await row(bucketKey)).tokens,
      beforeFailure,
      "Unknown/cancelled usage must retain the reservation",
    );

    const budgetKey = key();
    const allowance = await reserveAgentTokens(budgetKey);
    assert.ok(allowance.allowed);
    await settleAgentTokens(allowance.reservation, AGENT_TOKEN_CAPACITY + 100);
    assert.equal(
      (await row(budgetKey)).tokens,
      0,
      "An overshooting final step must empty the bucket",
    );
    const exhausted = await reserveAgentTokens(budgetKey);
    assert.ok(!exhausted.allowed && exhausted.reason === "budget");
    assert.ok(
      exhausted.retryAfter > 17000 && exhausted.retryAfter <= AGENT_BUCKET_WINDOW_MS / 1000,
    );
    await db
      .update(agentBuckets)
      .set({ resetAt: new Date(0), requestResetAt: new Date(0) })
      .where(eq(agentBuckets.key, budgetKey));
    const refreshed = await reserveAgentTokens(budgetKey);
    assert.ok(refreshed.allowed);
    assert.equal((await row(budgetKey)).tokens, AGENT_TOKEN_CAPACITY - AGENT_TURN_RESERVATION);
    assert.ok(refreshed.reservation.resetAt.getTime() > Date.now() + AGENT_BUCKET_WINDOW_MS - 5000);
    await settleAgentTokens(allowance.reservation, 0);
    assert.equal(
      (await row(budgetKey)).leaseId,
      refreshed.reservation.leaseId,
      "Old settlement must not touch a new window/lease",
    );
    await settleAgentTokens(refreshed.reservation, 100);

    const leaseKey = key();
    const stale = await reserveAgentTokens(leaseKey);
    assert.ok(stale.allowed);
    await db
      .update(agentBuckets)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(agentBuckets.key, leaseKey));
    const recovered = await reserveAgentTokens(leaseKey);
    assert.ok(recovered.allowed);
    await settleAgentTokens(stale.reservation, 0);
    assert.equal((await row(leaseKey)).leaseId, recovered.reservation.leaseId);
    assert.equal((await row(leaseKey)).tokens, AGENT_TOKEN_CAPACITY - 2 * AGENT_TURN_RESERVATION);
    await settleAgentTokens(recovered.reservation, 100);

    const independent = await reserveAgentTokens(key());
    assert.ok(independent.allowed, "Other IPs must retain their own allowance");
    await settleAgentTokens(independent.reservation, 100);
    await db
      .update(agentBuckets)
      .set({ resetAt: new Date(0), leaseExpiresAt: new Date(0) })
      .where(eq(agentBuckets.key, bucketKey));
    await pruneAgentBuckets();
    assert.equal(await row(bucketKey), undefined);
    assert.ok(await row(budgetKey), "Cleanup must retain active windows");

    const testEnv = process.env as Record<string, string | undefined>;
    const originalVercel = testEnv.VERCEL;
    const originalNodeEnv = testEnv.NODE_ENV;
    try {
      testEnv.VERCEL = "1";
      const request = (ip: string) =>
        new Request("https://demo.example/api/agent", {
          headers: { "x-vercel-forwarded-for": ip },
        });
      assert.equal(
        agentIpKey(request("2001:db8::1")),
        agentIpKey(request("2001:0db8:0:0:0:0:0:1")),
      );
      assert.notEqual(agentIpKey(request("192.0.2.1")), agentIpKey(request("192.0.2.2")));
      assert.match(agentIpKey(request("192.0.2.1")), /^[a-f0-9]{64}$/);
      assert.throws(() => agentIpKey(request("not-an-ip")), /trusted client IP/);
      assert.throws(
        () =>
          agentIpKey(
            new Request("https://demo.example/api/agent", {
              headers: { "x-forwarded-for": "192.0.2.1" },
            }),
          ),
        /trusted client IP/,
      );
      delete testEnv.VERCEL;
      testEnv.NODE_ENV = "production";
      assert.throws(() => agentIpKey(request("192.0.2.1")), /trusted client IP/);
      testEnv.NODE_ENV = "development";
      assert.equal(
        agentIpKey(request("192.0.2.1")),
        agentIpKey(request("192.0.2.2")),
        "Local forwarded headers must not create new buckets",
      );
    } finally {
      if (originalVercel === undefined) delete testEnv.VERCEL;
      else testEnv.VERCEL = originalVercel;
      if (originalNodeEnv === undefined) delete testEnv.NODE_ENV;
      else testEnv.NODE_ENV = originalNodeEnv;
    }
    console.log(
      "PASS: shared IP bucket, concurrent admission, usage accounting, burst limit, five-hour reset, cancellation charge, expired leases, cleanup, and trusted/hashed IP identity.",
    );
  } finally {
    if (keys.length) await db.delete(agentBuckets).where(inArray(agentBuckets.key, keys));
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
