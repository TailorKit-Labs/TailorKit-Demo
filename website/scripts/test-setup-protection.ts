import "./test-env";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db, pool } from "../lib/drizzle";
import { user, tenants } from "../lib/schema";
import { SETUP_BOT_CHECK_LEVEL, SETUP_PROTECTED_PATHS } from "../lib/setup-protection";
import { CURRENT_SETUP_VERSION } from "../lib/provision";
import stripeConfig from "../../apps/stripe/patchsmith.config";
const originalStripeAppId = stripeConfig.appId;
stripeConfig.appId = "test-stripe-source";
// Configure the fixture before the router initializes the shared Patchsmith server.
const originalProjectKey = process.env.PATCHSMITH_PROJECT_KEY;
process.env.PATCHSMITH_PROJECT_KEY = "test-key-no-platform-spend";
const { router } = await import("../routers");
const { handleRpcRequest } = await import("../routers/handler");

const origin = "http://localhost:3000";
const hasCode = (code: string) => (error: unknown) =>
  error instanceof ORPCError && error.code === code;

async function main() {
  const originalFetch = globalThis.fetch;
  const contextSymbol = Symbol.for("@vercel/request-context");
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const originalContext = globals[contextSymbol];
  const savedEnv = {
    VERCEL: process.env.VERCEL,
    PATCHSMITH_PROJECT_KEY: originalProjectKey,
  };
  const requests = new AsyncLocalStorage<Request>();
  let mode: "human" | "bot" | "unavailable" | "invalid" = "human";
  let botChecks = 0;
  let installations = 0;
  let signIns = 0;
  let userId: string | undefined;
  const client = (cookie?: string): RouterClient<typeof router> =>
    createORPCClient(
      new RPCLink({
        origin,
        url: "/rpc",
        headers: { origin, ...(cookie ? { cookie } : {}) },
        fetch: (url, init) => {
          const request = new Request(url, init);
          return requests.run(request, () => handleRpcRequest(request));
        },
      }),
    );
  const signIn = () => {
    const request = new Request(`${origin}/api/auth/sign-in/anonymous`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-forwarded-for": `198.51.100.${++signIns}`,
      },
      body: "{}",
    });
    return requests.run(request, () => auth.handler(request));
  };
  try {
    process.env.VERCEL = "1"; // Exercise deployed verification, even in local tests.
    globals[contextSymbol] = {
      get: () => ({
        url: requests.getStore()?.url,
        headers: {
          ...Object.fromEntries(requests.getStore()?.headers ?? []),
          "x-vercel-oidc-token": "test-oidc",
          "x-is-human": "test-challenge",
        },
        mutateResponseHeadersBeforeFlush: () => {},
      }),
    };
    globalThis.fetch = async (url, init) => {
      const request = new Request(url, init);
      if (request.url.startsWith("https://api.vercel.com/bot-protection/")) {
        botChecks++;
        const body = await request.json();
        assert.equal(SETUP_BOT_CHECK_LEVEL, "basic");
        assert.equal(body.forceCheckLevel, "basic");
        assert.ok(SETUP_PROTECTED_PATHS.some((path) => path === new URL(body.url).pathname));
        if (mode === "unavailable") throw new Error("Simulated BotID outage");
        return Response.json(mode === "invalid" ? {} : { isBot: mode === "bot" });
      }
      assert.equal(new URL(request.url).pathname, "/api/platform/apps/install");
      installations++;
      return Response.json({ id: "test-installation" });
    };

    const initialUsers = await db.$count(user);
    for (const blockedMode of ["bot", "unavailable", "invalid"] as const) {
      mode = blockedMode;
      const response = await signIn();
      assert.equal(response.status, mode === "bot" ? 403 : 503);
      assert.equal(response.headers.getSetCookie().length, 0);
      assert.equal(await db.$count(user), initialUsers, "Rejected sign-in cannot create users");
    }

    mode = "human";
    const response = await signIn();
    assert.equal(response.status, 200);
    const payload = await response.json();
    userId = payload.user.id;
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const browser = client(cookie);
    const tenant = async () =>
      (await db.select().from(tenants).where(eq(tenants.userId, payload.user.id)))[0];
    const beforeUnauthorized = botChecks;
    await assert.rejects(() => client().workspace.provision(), hasCode("UNAUTHORIZED"));
    await assert.rejects(() => client().workspace.installApps(), hasCode("UNAUTHORIZED"));
    const direct = createRouterClient(router, {
      context: {
        resolveUserId: async () => payload.user.id,
        resolveTenant: async () => {
          throw new Error("Setup cannot resolve a workspace before verification");
        },
      },
    });
    await assert.rejects(() => direct.workspace.provision(), hasCode("FORBIDDEN"));
    await assert.rejects(() => direct.workspace.installApps(), hasCode("FORBIDDEN"));
    assert.equal(botChecks, beforeUnauthorized);

    for (const blockedMode of ["bot", "unavailable", "invalid"] as const) {
      mode = blockedMode;
      const code = mode === "bot" ? "FORBIDDEN" : "SERVICE_UNAVAILABLE";
      await assert.rejects(() => browser.workspace.provision(), hasCode(code));
      await assert.rejects(() => browser.workspace.installApps(), hasCode(code));
      assert.equal(await tenant(), undefined, "Neither setup endpoint may create a workspace");
      assert.equal(installations, 0);
    }

    mode = "human";
    await browser.workspace.provision();
    const seeded = await tenant();
    assert.equal(seeded.setupVersion, 1);
    mode = "bot";
    await assert.rejects(() => browser.workspace.installApps(), hasCode("FORBIDDEN"));
    assert.equal((await tenant()).setupVersion, 1);
    assert.equal(installations, 0);
    mode = "human";
    await browser.workspace.installApps();
    await browser.workspace.provision();
    await browser.workspace.installApps();
    assert.equal((await tenant()).id, seeded.id);
    assert.equal((await tenant()).setupVersion, CURRENT_SETUP_VERSION);
    assert.equal(installations, 3, "Retries must reuse all three completed installations");
    const beforeReads = botChecks;
    assert.equal((await browser.workspace.snapshot()).contacts.length, 30);
    assert.ok(await auth.api.getSession({ headers: new Headers({ cookie }) }));
    assert.equal(botChecks, beforeReads, "Normal reads must not invoke BotID");
    console.log(
      "PASS: setup BotID enforcement, fail-closed errors, no rejected writes or installs, direct-call protection, human setup, and idempotent retries.",
    );
  } finally {
    stripeConfig.appId = originalStripeAppId;
    globalThis.fetch = originalFetch;
    globals[contextSymbol] = originalContext;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (userId) await db.delete(user).where(eq(user.id, userId));
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
