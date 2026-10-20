import assert from "node:assert/strict";
import { test } from "node:test";
import { defineContract } from "patchsmith";
import { createServer } from "patchsmith/server";
import messagesConfig from "../../apps/messages/patchsmith.config";
import { installMessages } from "../lib/install-messages";
import { contract } from "../lib/patchsmith";

const appId = "app-shared-messages";
const scope = { name: "workspace", value: { workspaceId: "test-workspace" } };

function platform({ projectKey = "test-key", fail = false } = {}) {
  const calls: { path: string; body: unknown }[] = [];
  const request: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    assert.equal(req.method, "POST");
    assert.equal(req.headers.get("authorization"), "Bearer test-key");
    calls.push({ path: new URL(req.url).pathname, body: await req.json() });
    if (fail) return Response.json({ message: "Install unavailable" }, { status: 503 });
    return Response.json({ id: `installation-${calls.length}` });
  };
  // Exercise the real SDK transport and the host's workspace scope validator.
  const server = createServer({
    contract: defineContract({ scopes: contract.scopes, components: {} }),
    baseUrl: "http://localhost:3000/api/patchsmith",
    projectKey,
    $internal: { platformFetch: request },
  });
  return { installApp: server.experimental.installApp, calls };
}

void test("installs the published app with one request and no asset uploads", async () => {
  const { installApp, calls } = platform();
  assert.equal(await installMessages("test-workspace", { appId, installApp }), "installation-1");
  assert.deepEqual(calls, [
    { path: "/api/platform/apps/install", body: { app: { shortId: appId }, scope } },
  ]);
});

void test("uses the published app ID from the Messages CLI config by default", async () => {
  const { installApp, calls } = platform();
  await installMessages("test-workspace", { installApp });
  assert.deepEqual(calls, [
    { path: "/api/platform/apps/install", body: { app: { id: messagesConfig.appId }, scope } },
  ]);
});

void test("uses the same source app for separate workspace installations", async () => {
  const { installApp, calls } = platform();
  await installMessages("workspace-a", { appId, installApp });
  await installMessages("workspace-b", { appId, installApp });
  assert.deepEqual(calls, [
    {
      path: "/api/platform/apps/install",
      body: {
        app: { shortId: appId },
        scope: { name: "workspace", value: { workspaceId: "workspace-a" } },
      },
    },
    {
      path: "/api/platform/apps/install",
      body: {
        app: { shortId: appId },
        scope: { name: "workspace", value: { workspaceId: "workspace-b" } },
      },
    },
  ]);
});

void test("platform failures propagate so provisioning cannot mark setup complete", async () => {
  const { installApp, calls } = platform({ fail: true });
  await assert.rejects(installMessages("test-workspace", { appId, installApp }));
  assert.equal(calls.length, 1);
});

void test("missing source app ID, project key or workspace fails before network work", async () => {
  const { installApp, calls } = platform({ projectKey: "" });
  await assert.rejects(
    installMessages("test-workspace", { appId: "", installApp }),
    /apps\/messages\/patchsmith\.config\.ts/,
  );
  await assert.rejects(installMessages("test-workspace", { appId, installApp }), /projectKey/);
  const configured = platform();
  await assert.rejects(installMessages("", { appId, installApp: configured.installApp }));
  assert.equal(calls.length + configured.calls.length, 0);
});
