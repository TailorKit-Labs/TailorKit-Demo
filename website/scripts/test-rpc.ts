import "./test-env";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db, pool } from "../lib/drizzle";
import { user } from "../lib/schema";
import { randomUUID } from "node:crypto";
import { beginAgentChat } from "../routers/chats";
import { router } from "../routers";
import { handleRpcRequest } from "../routers/handler";
import { tenantFromHeaders, verifiedWorkspaceContext } from "../routers/context";

const origin = "http://localhost:3000";
const hasCode = (code: string) => (error: unknown) =>
  error instanceof ORPCError && error.code === code;

async function main() {
  const users: string[] = [];
  try {
    let refreshes = 0;
    let requests = 0;
    function browserClient(cookie?: string): RouterClient<typeof router> {
      return createORPCClient(
        new RPCLink({
          origin,
          url: "/rpc",
          headers: { origin, ...(cookie ? { cookie } : {}) },
          fetch: async (url, init) => {
            requests++;
            const response = await handleRpcRequest(new Request(url, init), () => {
              refreshes++;
            });
            assert.equal(response.headers.get("cache-control"), "private, no-store");
            return response;
          },
        }),
      );
    }
    const workspaces = [];
    for (let index = 0; index < 2; index++) {
      const response = await auth.api.signInAnonymous({ asResponse: true });
      const payload = await response.json();
      users.push(payload.user.id);
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const client = browserClient(cookie);
      await assert.rejects(() => client.workspace.snapshot(), hasCode("FORBIDDEN"));
      await client.workspace.provision();
      await client.workspace.provision();
      const tenant = await tenantFromHeaders(new Headers({ cookie }));
      workspaces.push({ tenant, cookie });
    }
    const [first, second] = workspaces;
    refreshes = 0;
    const browser = browserClient(first.cookie);
    const otherBrowser = browserClient(second.cookie);
    await assert.rejects(() => browserClient().workspace.get({}), hasCode("UNAUTHORIZED"));
    await assert.rejects(() => browserClient().workspace.provision(), hasCode("UNAUTHORIZED"));
    const initial = await browser.workspace.snapshot();
    assert.equal(initial.tenant.id, first.tenant.id);
    assert.equal(initial.contacts.length, 30);
    const contact = await browser.contacts.create({
      name: "RPC integration",
      email: "rpc@example.com",
      company: "oRPC",
      role: "Builder",
      status: "lead",
    });
    assert.equal(refreshes, 1);
    await assert.rejects(
      () => otherBrowser.contacts.get({ id: contact.contact.id }),
      hasCode("NOT_FOUND"),
    );
    await assert.rejects(
      () => otherBrowser.contacts.delete({ id: contact.contact.id }),
      hasCode("NOT_FOUND"),
    );
    await assert.rejects(
      () => browser.deals.create({ title: "Invalid amount", value: -1 }),
      hasCode("BAD_REQUEST"),
    );
    await assert.rejects(
      () => browser.tasks.create({ title: "Invalid date", dueDate: "not-a-date" }),
      hasCode("BAD_REQUEST"),
    );
    assert.equal(refreshes, 1, "Failed calls must not invalidate the host");

    // The server/client share procedures and validation, but direct calls must
    // never use fetch. The same singleton context factory must isolate requests.
    const headers = new AsyncLocalStorage<Headers>();
    const shared = createRouterClient(router, {
      context: () => ({
        resolveTenant: () => tenantFromHeaders(headers.getStore()!),
      }),
    });
    const originalFetch = globalThis.fetch;
    const beforeDirect = requests;
    globalThis.fetch = async () => {
      throw new Error("SSR/server tools must not make HTTP requests");
    };
    try {
      const direct = createRouterClient(router, {
        context: verifiedWorkspaceContext(first.tenant.id),
      });
      await assert.rejects(() => direct.workspace.provision(), hasCode("UNAUTHORIZED"));
      await direct.contacts.update({ ...contact.contact, status: "customer" });
      const batches = await Promise.all(
        Array.from({ length: 8 }, async (_, index) => {
          const workspace = index % 2 ? first : second;
          return headers.run(new Headers({ cookie: workspace.cookie }), async () => {
            const snapshot = await shared.workspace.snapshot();
            assert.equal(snapshot.tenant.id, workspace.tenant.id);
            assert.equal(
              snapshot.contacts.some((row) => row.id === contact.contact.id),
              workspace === first,
            );
            return snapshot.tenant.id;
          });
        }),
      );
      assert.equal(new Set(batches).size, 2);
      await assert.rejects(
        () => direct.tasks.create({ title: "Still validated", dueDate: "invalid" }),
        hasCode("BAD_REQUEST"),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(requests, beforeDirect);
    assert.equal(
      (await browser.contacts.get({ id: contact.contact.id })).contact.status,
      "customer",
    );
    const chatId = randomUUID();
    await beginAgentChat(first.tenant.id, chatId, [
      { id: "user-message", role: "user", parts: [{ type: "text", text: "Only my workspace" }] },
    ]);
    assert.equal((await browser.chats.get({ id: chatId })).messages[0].id, "user-message");
    assert.equal((await browser.chats.list()).latest?.id, chatId);
    assert.equal((await otherBrowser.chats.list()).chats.length, 0);
    await assert.rejects(() => otherBrowser.chats.get({ id: chatId }), hasCode("NOT_FOUND"));
    await assert.rejects(() => browser.chats.get({ id: "invalid" }), hasCode("BAD_REQUEST"));
    await assert.rejects(() => browserClient().chats.list(), hasCode("UNAUTHORIZED"));
    const ssrOrigin = process.env.RPC_SSR_URL;
    if (ssrOrigin) {
      const live = createORPCClient<RouterClient<typeof router>>(
        new RPCLink({
          origin: ssrOrigin,
          url: "/rpc",
          headers: { origin: ssrOrigin, cookie: first.cookie },
        }),
      );
      await live.workspace.provision();
      assert.equal((await live.chats.get({ id: chatId })).id, chatId);
      assert.equal((await live.chats.list()).latest?.id, chatId);
      // Exercise the actual production App Router with two independent sessions.
      const [ownHtml, otherHtml] = await Promise.all(
        [first, second].map(async (workspace) => {
          const response = await fetch(new URL(`/contacts/${contact.contact.id}`, ssrOrigin), {
            headers: { cookie: workspace.cookie },
          });
          assert.equal(response.status, 200);
          return response.text();
        }),
      );
      assert.ok(
        ownHtml.includes("RPC integration"),
        "Contact data must exist in the initial SSR HTML",
      );
      assert.ok(otherHtml.includes("This page has moved on"));
      assert.ok(
        !otherHtml.includes("RPC integration"),
        "Concurrent SSR must not expose another workspace's contact",
      );
    }
    await browser.contacts.delete({ id: contact.contact.id });
    assert.equal(refreshes, 2);
    assert.equal((await browser.workspace.snapshot()).contacts.length, initial.contacts.length);
    for (const request of [
      new Request(`${origin}/rpc/contacts/create`, { method: "GET", headers: { origin } }),
      new Request(`${origin}/rpc/contacts/create`, { method: "POST" }),
      new Request(`${origin}/rpc/contacts/create`, {
        method: "POST",
        headers: { origin: "https://elsewhere.example", cookie: first.cookie },
      }),
    ]) {
      const response = await handleRpcRequest(request);
      assert.ok([403, 405].includes(response.status));
    }
    const oversized = await handleRpcRequest(
      new Request(`${origin}/rpc/contacts/create`, {
        method: "POST",
        headers: { origin, cookie: first.cookie, "content-type": "application/json" },
        body: JSON.stringify({ json: { name: "x".repeat(61000) } }),
      }),
    );
    assert.equal(oversized.status, 413);
    console.log(
      "PASS: authenticated oRPC HTTP + direct clients, validation, cache invalidation, errors, CSRF/method/body limits, and concurrent request isolation without server HTTP.",
    );
  } finally {
    for (const id of users) await db.delete(user).where(eq(user.id, id));
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
