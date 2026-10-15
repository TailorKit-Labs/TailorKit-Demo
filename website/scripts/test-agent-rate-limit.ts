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
    assert.equal(
      admitted.length,
      AGENT_REQUESTS_PER_MINUTE,
      "One IP may run multiple chats within its shared limits",
    );
    assert.ok(
      raced
        .filter((result) => !result.allowed)
        .every((result) => !result.allowed && result.reason === "burst"),
    );
    const first = admitted[0];
    assert.ok(first.allowed);
    assert.equal(
      (await row(bucketKey)).tokens,
      AGENT_TOKEN_CAPACITY - admitted.length * AGENT_TURN_RESERVATION,
    );
    await Promise.all([
      ...admitted.toReversed().map((result) => settleAgentTokens(result.reservation, 2300)),
      settleAgentTokens(first.reservation, 2300),
    ]);
    assert.equal((await row(bucketKey)).tokens, AGENT_TOKEN_CAPACITY - admitted.length * 2300);
    await settleAgentTokens(first.reservation, 0);
    assert.equal(
      (await row(bucketKey)).tokens,
      AGENT_TOKEN_CAPACITY - admitted.length * 2300,
      "Settlement must be idempotent",
    );

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
    await settleAgentTokens(afterMinute.reservation, 0);
    assert.equal(
      (await row(bucketKey)).tokens,
      beforeFailure,
      "Unknown usage also settles at most once",
    );

    const budgetKey = key();
    const allowance = await reserveAgentTokens(budgetKey);
    assert.ok(allowance.allowed);
    await settleAgentTokens(allowance.reservation, AGENT_TOKEN_CAPACITY + 100);
    assert.equal(
      (await row(budgetKey)).tokens,
      -100,
      "An overshooting final step must retain debt until the window resets",
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
      (await row(budgetKey)).tokens,
      AGENT_TOKEN_CAPACITY - AGENT_TURN_RESERVATION,
      "Old settlement must not touch a new window",
    );
    await settleAgentTokens(refreshed.reservation, 100);

    const windowKey = key();
    const stale = await reserveAgentTokens(windowKey);
    assert.ok(stale.allowed);
    await db
      .update(agentBuckets)
      .set({ resetAt: new Date(0), requestResetAt: new Date(0) })
      .where(eq(agentBuckets.key, windowKey));
    const recovered = await reserveAgentTokens(windowKey);
    assert.ok(recovered.allowed);
    await settleAgentTokens(stale.reservation, 0);
    assert.deepEqual((await row(windowKey)).reservationIds, [recovered.reservation.id]);
    assert.equal((await row(windowKey)).tokens, AGENT_TOKEN_CAPACITY - AGENT_TURN_RESERVATION);
    await settleAgentTokens(recovered.reservation, 100);

    const overageKey = key();
    const overage = await reserveAgentTokens(overageKey);
    const concurrent = await reserveAgentTokens(overageKey);
    assert.ok(overage.allowed && concurrent.allowed);
    await settleAgentTokens(overage.reservation, AGENT_TOKEN_CAPACITY + 100);
    await settleAgentTokens(concurrent.reservation, 0);
    assert.equal(
      (await row(overageKey)).tokens,
      -100,
      "A concurrent refund must not erase another turn's overage",
    );
    const overdrawn = await reserveAgentTokens(overageKey);
    assert.ok(!overdrawn.allowed && overdrawn.reason === "budget");

    const heldKey = key();
    const held = await reserveAgentTokens(heldKey);
    assert.ok(held.allowed);
    await db
      .update(agentBuckets)
      .set({ requestResetAt: new Date(0) })
      .where(eq(agentBuckets.key, heldKey));
    const budgetRace = await Promise.all(
      Array.from({ length: 8 }, () => reserveAgentTokens(heldKey)),
    );
    assert.equal(
      budgetRace.filter((result) => result.allowed).length,
      4,
      "In-flight reservations must prevent over-admission after the minute resets",
    );
    assert.ok(budgetRace.some((result) => !result.allowed && result.reason === "budget"));
    assert.equal((await row(heldKey)).tokens, 0);

    const legacyKey = key();
    await db.insert(agentBuckets).values({
      key: legacyKey,
      tokens: AGENT_TOKEN_CAPACITY,
      resetAt: new Date(Date.now() + AGENT_BUCKET_WINDOW_MS),
      requests: 0,
      requestResetAt: new Date(Date.now() + 60000),
      leaseId: "legacy-lock",
      leaseExpiresAt: new Date(Date.now() + 330000),
    });
    const legacy = await reserveAgentTokens(legacyKey);
    assert.ok(legacy.allowed, "A legacy IP lease must no longer block a new request");
    await settleAgentTokens(legacy.reservation, 100);
    assert.equal((await row(legacyKey)).tokens, AGENT_TOKEN_CAPACITY - 100);

    const independent = await reserveAgentTokens(key());
    assert.ok(independent.allowed, "Other IPs must retain their own allowance");
    await settleAgentTokens(independent.reservation, 100);
    await db
      .update(agentBuckets)
      .set({ resetAt: new Date(0) })
      .where(eq(agentBuckets.key, heldKey));
    await pruneAgentBuckets();
    assert.ok(await row(heldKey), "Cleanup grace must protect requests crossing a bucket reset");
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
      "PASS: concurrent chats per IP, atomic token reservations, out-of-order/idempotent settlement, overage debt, burst limit, five-hour reset, cancellation charge, cleanup, and trusted/hashed IP identity.",
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
