import assert from "node:assert/strict";
import { test } from "node:test";
import { defineContract } from "patchsmith";
import { createServer } from "patchsmith/server";
import { z } from "zod";
import { patchsmithOrigin, patchsmithRequestOrigin } from "../lib/patchsmith-origin";

const contract = defineContract({
  scopes: { workspace: z.object({ workspaceId: z.string() }) },
  components: {},
  views: { "/": z.object({}) },
  slots: { panel: { views: ["/"] } },
});

const preview = {
  VERCEL_ENV: "preview",
  VERCEL_URL: "demo-build-123.vercel.app",
  VERCEL_BRANCH_URL: "demo-git-feature.vercel.app",
  BETTER_AUTH_URL: "https://demo.patchsmith.io",
};

void test("preview requests accept both Vercel deployment and branch origins", async () => {
  for (const hostname of [preview.VERCEL_URL, preview.VERCEL_BRANCH_URL]) {
    const url = `https://${hostname}/api/patchsmith/views`;
    const origin = patchsmithRequestOrigin(url, preview);
    assert.equal(origin, `https://${hostname}`);
    const host = createServer({ contract, baseUrl: new URL("/api/patchsmith", origin) });
    // Use the real SDK origin check and authenticated discovery handler without
    // making a platform request: an explicit empty installation selection is valid.
    const response = await host.handler(
      new Request(url, {
        method: "POST",
        headers: { origin: `https://${hostname}`, "content-type": "application/json" },
        body: JSON.stringify({ slot: "panel", activeView: null, appIds: [] }),
      }),
      {
        authenticate: async () => ({
          subjectId: "visitor",
          scopes: { workspace: { workspaceId: "preview-workspace" } },
        }),
      },
    );
    assert.equal(response.status, 200, await response.clone().text());
    assert.deepEqual(await response.json(), { data: [], status: "ready" });
  }
});

void test("unknown hosts cannot change the configured public origin or bypass the SDK check", async () => {
  for (const origin of ["https://attacker.example", "https://demo-git-other.vercel.app"]) {
    const url = `${origin}/api/patchsmith/views`;
    const selected = patchsmithRequestOrigin(url, preview);
    assert.equal(selected, patchsmithOrigin(preview));
    const host = createServer({ contract, baseUrl: new URL("/api/patchsmith", selected) });
    const response = await host.handler(
      new Request(url, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ slot: "panel", activeView: null, appIds: [] }),
      }),
      {
        authenticate: async () => {
          assert.fail("Unknown origins must be rejected before authenticating");
        },
      },
    );
    assert.equal(response.status, 400);
    assert.equal(await response.text(), "Invalid request");
  }
});

void test("production and local origins do not adopt preview aliases", () => {
  const production = { ...preview, VERCEL_ENV: "production" };
  assert.equal(patchsmithOrigin(production), "https://demo.patchsmith.io");
  assert.equal(
    patchsmithRequestOrigin(
      `https://${preview.VERCEL_BRANCH_URL}/api/patchsmith/views`,
      production,
    ),
    "https://demo.patchsmith.io",
  );
  assert.equal(patchsmithOrigin({}), "http://localhost:3000");
  assert.equal(
    patchsmithOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "demo.patchsmith.io" }),
    "https://demo.patchsmith.io",
  );
});
