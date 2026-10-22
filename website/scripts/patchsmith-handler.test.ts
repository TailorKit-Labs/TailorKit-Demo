import "./test-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db, pool } from "../lib/drizzle";
import { tenants, user } from "../lib/schema";
import { CURRENT_SETUP_VERSION } from "../lib/provision";
import { tenantForUser } from "../routers/context";

void test("Patchsmith authenticates once per request and isolates workspace view resolution", async () => {
  const nativeFetch = globalThis.fetch;
  const previousKey = process.env.PATCHSMITH_PROJECT_KEY;
  const users: string[] = [];
  const resolutionScopes: unknown[] = [];
  process.env.PATCHSMITH_PROJECT_KEY = "test-project-key";
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    assert.ok(new URL(request.url).pathname.endsWith("/apps/runtime/resolve"));
    resolutionScopes.push((await request.json()).scopes);
    return Response.json({ data: [], status: "ready", warnings: [] });
  };
  try {
    const { POST } = await import("../app/api/patchsmith/[...patchsmith]/route");
    const fixtures = [];
    for (let index = 0; index < 2; index++) {
      const response = await auth.api.signInAnonymous({ asResponse: true });
      assert.equal(response.status, 200);
      const payload = await response.json();
      users.push(payload.user.id);
      const workspaceId = randomUUID();
      await db.insert(tenants).values({
        id: workspaceId,
        userId: payload.user.id,
        setupVersion: CURRENT_SETUP_VERSION,
      });
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      fixtures.push({ cookie, workspaceId });
    }
    const viewsRequest = (cookie?: string) =>
      new Request("http://localhost:3000/api/patchsmith/views", {
        method: "POST",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({
          slot: "page",
          activeView: {
            view: "/",
            layers: [
              {
                path: "/",
                status: "ready",
                context: { workspace: { id: "untrusted", name: "Untrusted" }, page: "/" },
              },
            ],
          },
        }),
      });
    assert.equal((await POST(viewsRequest())).status, 401);
    assert.equal(resolutionScopes.length, 0);

    for (const { cookie, workspaceId } of fixtures) {
      let queries = 0;
      const acquired = () => {
        queries++;
      };
      pool.on("acquire", acquired);
      try {
        const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
        assert.ok(session);
        await tenantForUser(session.user.id);
        const oneAuthentication = queries;
        assert.ok(oneAuthentication > 0);
        queries = 0;
        const response = await POST(viewsRequest(cookie));
        assert.equal(response.status, 200, await response.clone().text());
        assert.deepEqual(await response.json(), { data: [], status: "ready", warnings: [] });
        assert.equal(queries, oneAuthentication, "The route must read the session only once");
        assert.match(
          response.headers.get("server-timing") ?? "",
          /workspace_auth;dur=\d+\.\d, host;dur=\d+\.\d/,
        );
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.deepEqual(resolutionScopes.at(-1), [{ name: "workspace", value: { workspaceId } }]);
      } finally {
        pool.off("acquire", acquired);
      }
    }
  } finally {
    globalThis.fetch = nativeFetch;
    if (previousKey === undefined) delete process.env.PATCHSMITH_PROJECT_KEY;
    else process.env.PATCHSMITH_PROJECT_KEY = previousKey;
    for (const id of users) await db.delete(user).where(eq(user.id, id));
    await pool.end();
  }
});
