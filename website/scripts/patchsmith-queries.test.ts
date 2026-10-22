import assert from "node:assert/strict";
import { test } from "node:test";
import { dehydrate, hydrate, QueryObserver } from "@tanstack/react-query";
import { makeQueryClient } from "../lib/query-client";
import { orpc } from "../lib/orpc";
import { viewsQueryOptions, type ViewsApi } from "../lib/patchsmith-queries";

const workspace = { id: "workspace-a", name: "Demo" };
const page = {
  app: { id: "doom", name: "Doom" },
  key: "doom",
  data: { difficulty: "normal" },
  metadata: { label: "Play Doom" },
};
const ready = { status: "ready" as const, data: [page], warnings: [] };

void test("pending server prefetch hydrates and deduplicates browser consumers without refetching", async () => {
  const server = makeQueryClient();
  const browser = makeQueryClient();
  let requests = 0;
  let resolve!: (value: typeof ready) => void;
  const response = new Promise<typeof ready>((done) => {
    resolve = done;
  });
  const serverApi: ViewsApi = {
    views: async (input) => {
      requests++;
      assert.equal(input.slot, "page");
      assert.ok(input.signal instanceof AbortSignal);
      assert.deepEqual(input.activeView, {
        view: "/",
        layers: [{ path: "/", status: "ready", context: { workspace, page: "/contacts" } }],
      });
      return response;
    },
  };
  const browserApi: ViewsApi = {
    views: async () => {
      throw new Error("Hydration must reuse the server request");
    },
  };
  try {
    // Real tenants include server-only fields; these must not change the key or
    // leak into the context sent to app resolvers.
    const tenant = { ...workspace, setupVersion: 10 };
    const prefetch = server.prefetchQuery(
      viewsQueryOptions(serverApi, tenant, "page", "/contacts"),
    );
    hydrate(browser, dehydrate(server));
    const options = viewsQueryOptions(browserApi, workspace, "page", "/contacts");
    const sidebar = browser.fetchQuery(options);
    const appPage = browser.fetchQuery(options);
    resolve(ready);
    await prefetch;
    assert.deepEqual(await sidebar, ready);
    assert.deepEqual(await appPage, ready);
    assert.deepEqual(await browser.fetchQuery(options), ready);
    assert.deepEqual(new QueryObserver(browser, options).getCurrentResult().data, [page]);
    assert.equal(requests, 1);
  } finally {
    server.clear();
    browser.clear();
  }
});

void test("page queries vary by workspace and root URL; single slots reuse discovery across routes", async () => {
  const client = makeQueryClient();
  const calls: Parameters<ViewsApi["views"]>[0][] = [];
  const api: ViewsApi = {
    views: async (input) => {
      calls.push(input);
      return ready;
    },
  };
  try {
    for (const slot of ["panel", "navbar", "page"] as const) {
      await client.fetchQuery(viewsQueryOptions(api, workspace, slot, "/"));
      await client.fetchQuery(viewsQueryOptions(api, workspace, slot, "/contacts"));
      await client.fetchQuery(
        viewsQueryOptions(api, { ...workspace, id: "workspace-b" }, slot, "/"),
      );
    }
    assert.equal(calls.filter((call) => call.slot === "page").length, 3);
    assert.equal(calls.filter((call) => call.slot === "panel").length, 2);
    assert.equal(calls.filter((call) => call.slot === "navbar").length, 2);
    assert.ok(
      calls.filter((call) => call.slot !== "page").every((call) => call.activeView === null),
    );
  } finally {
    client.clear();
  }
});

void test("CRM mutations refresh all active app slots along with CRM data", async () => {
  const client = makeQueryClient();
  const calls: string[] = [];
  const api: ViewsApi = {
    views: async ({ slot }) => {
      calls.push(slot);
      return slot === "page" ? ready : { ...ready, data: [{ app: page.app }] };
    },
  };
  const unsubscribes: (() => void)[] = [];
  try {
    for (const slot of ["page", "panel", "navbar"] as const) {
      const option = viewsQueryOptions(api, workspace, slot, "/");
      await client.fetchQuery(option);
      unsubscribes.push(new QueryObserver(client, option).subscribe(() => {}));
    }
    const crmOptions = {
      queryKey: [...orpc.key(), "test"],
      queryFn: async () => {
        calls.push("crm");
        return ready;
      },
    };
    await client.fetchQuery(crmOptions);
    unsubscribes.push(new QueryObserver(client, crmOptions).subscribe(() => {}));
    calls.length = 0;
    const mutation = client.getMutationCache().build(client, { mutationFn: async () => "saved" });
    await mutation.execute(undefined);
    assert.deepEqual(calls.toSorted(), ["crm", "navbar", "page", "panel"]);
  } finally {
    for (const unsubscribe of unsubscribes) unsubscribe();
    client.clear();
  }
});

void test("failed discovery can be retried and partial-response warnings remain cached", async () => {
  const client = makeQueryClient();
  let fail = true;
  const warnings = [
    {
      appId: "other",
      code: "INSTANCE_RESOLUTION_TIMEOUT" as const,
      message: "Timed out",
      path: "/",
    },
  ];
  const api: ViewsApi = {
    views: async () => {
      if (fail) throw new Error("Unavailable");
      return { ...ready, warnings };
    },
  };
  try {
    const options = viewsQueryOptions(api, workspace, "page", "/");
    await assert.rejects(client.fetchQuery(options), /Unavailable/);
    fail = false;
    const observer = new QueryObserver(client, options);
    const result = await observer.refetch();
    assert.equal(result.isSuccess, true);
    assert.deepEqual(result.data, [page]);
    assert.deepEqual(client.getQueryData(options.queryKey)?.warnings, warnings);
  } finally {
    client.clear();
  }
});

void test("cancelling a view query aborts its direct API request", async () => {
  const client = makeQueryClient();
  let requestSignal: AbortSignal | undefined;
  const api: ViewsApi = {
    views: ({ signal }) => {
      requestSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  };
  try {
    const options = viewsQueryOptions(api, workspace, "page", "/");
    const pending = client.prefetchQuery(options);
    await client.cancelQueries({ queryKey: options.queryKey });
    await pending;
    assert.equal(requestSignal?.aborted, true);
  } finally {
    client.clear();
  }
});
