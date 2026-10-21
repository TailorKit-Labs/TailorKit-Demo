import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createAgentUIStreamResponse, simulateReadableStream, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { createCrmAgent } from "../lib/agents/crm-agent";
import { finishAgentMessages } from "../routers/chats";
import { AGENT_TIMEOUT_MS } from "../lib/agents/agent-limits";
import { contract } from "../lib/patchsmith";

const originalFetch = globalThis.fetch;
const originalKey = process.env.PATCHSMITH_PROJECT_KEY;
const originalOrigin = process.env.BETTER_AUTH_URL;
const originalVercelEnv = process.env.VERCEL_ENV;
type CallerContext = { subjectId: string; scopes: { workspace: { workspaceId: string } } };
const requests: { method: string; context: CallerContext }[] = [];
const callerContext = (tenant: { id: string; subjectId: string }): CallerContext => ({
  subjectId: tenant.subjectId,
  scopes: { workspace: { workspaceId: tenant.id } },
});
let failTransport = false;
let holdCall = false;
let toolError = false;
let emitProgress = false;
const buildResult = {
  answer: "Published Workspace app.",
  appId: "app-one",
  runId: "run-one",
  threadId: "00000000-0000-4000-8000-000000000001",
  finishReason: "stop",
};
let callStarted: (() => void) | undefined;
let callCancelled: (() => void) | undefined;

async function run(result: unknown) {
  const resolved = await result;
  if (resolved && typeof resolved === "object" && Symbol.asyncIterator in resolved) {
    let last: unknown;
    for await (const part of resolved as AsyncIterable<unknown>) last = part;
    return last;
  }
  return resolved;
}

// A real HTTP endpoint speaking the stateless MCP version used by Patchsmith.
// Redirect only the platform origin to this local fixture; never call live APIs.
const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET") {
      response.writeHead(405).end();
      return;
    }
    assert.equal(request.method, "POST");
    assert.equal(request.headers.authorization, "Bearer fixture-project-key");
    const context = JSON.parse(
      Buffer.from(String(request.headers["x-patchsmith-context"]), "base64url").toString(),
    );
    assert.equal(context.hostUrl, "https://forma.test/api/patchsmith");
    let body = "";
    for await (const chunk of request) body += chunk;
    const message = JSON.parse(body);
    assert.equal(request.headers["mcp-protocol-version"], "2026-07-28", message.method);
    requests.push({ method: message.method, context });
    if (failTransport) {
      response.writeHead(503).end("Transport unavailable");
      return;
    }
    let result: Record<string, unknown>;
    switch (message.method) {
      case "server/discover":
        result = { supportedVersions: ["2026-07-28"], capabilities: { tools: {} } };
        break;
      case "tools/call":
        if (holdCall) {
          response.on("close", () => callCancelled?.());
          callStarted?.();
          return;
        }
        result = {
          isError: toolError,
          content: [
            {
              type: "text",
              text: toolError ? "App lookup failed." : JSON.stringify({ apps: ["Workspace app"] }),
            },
          ],
        };
        assert.ok(["list_apps", "create_app", "edit_app"].includes(message.params.name));
        if (!toolError && message.params.name !== "list_apps")
          result.structuredContent = buildResult;
        break;
      default:
        throw new Error(`Unexpected MCP method: ${message.method}`);
    }
    const payload = {
      jsonrpc: "2.0",
      id: message.id,
      result: { resultType: "complete", ...result },
    };
    if (emitProgress && message.method === "tools/call") {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(
        `event: message\ndata: ${JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/progress",
          params: {
            progressToken: message.params._meta.progressToken,
            progress: 1,
            message: "Building the app",
          },
        })}\n\n`,
      );
      setTimeout(() => response.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`), 10);
    } else {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    }
  } catch (error) {
    console.error("MCP fixture rejected request:", error);
    response.writeHead(500).end(String(error));
  }
});

async function main() {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assert.equal(url, "https://patchsmith.io/api/platform/app-agent/mcp");
    return originalFetch(`http://127.0.0.1:${address.port}/mcp`, init);
  };
  process.env.PATCHSMITH_PROJECT_KEY = "fixture-project-key";
  process.env.BETTER_AUTH_URL = "https://forma.test";
  delete process.env.VERCEL_ENV;
  const { createPatchsmithTools } = await import("../lib/agents/patchsmith-tools");
  const { patchsmith: host } = await import("../lib/patchsmith-server");
  const tenant = { id: "workspace-one", name: "Demo", subjectId: "user-one" };
  const controller = new AbortController();
  const toolSets: NonNullable<ReturnType<typeof createPatchsmithTools>>[] = [];
  try {
    delete process.env.PATCHSMITH_PROJECT_KEY;
    assert.equal(createPatchsmithTools(tenant, tenant.subjectId), undefined);
    assert.equal(requests.length, 0, "Unconfigured CRM must not make MCP requests");
    process.env.PATCHSMITH_PROJECT_KEY = "fixture-project-key";
    const metadata = await host.handler(new Request("https://forma.test/api/patchsmith/meta"), {
      authenticate: () => callerContext(tenant),
    });
    assert.equal(metadata.status, 200, "App builders must be able to read the host contract");
    const hostMetadata = await metadata.text();
    assert.ok(!hostMetadata.includes("fixture-project-key"));
    assert.ok(hostMetadata.includes('"contacts"'), "MCP must use the existing CRM host tools");
    assert.ok(hostMetadata.includes('"Button"'), "MCP must use the existing host components");
    assert.equal(host.contract, contract);
    const unauthorized = await host.handler(new Request("https://forma.test/api/patchsmith/apps"), {
      authenticate: () => null,
    });
    assert.equal(unauthorized.status, 401);

    for (const identity of [
      tenant,
      { ...tenant, id: "workspace-two" },
      { ...tenant, subjectId: "user-two" },
    ]) {
      const start: number = requests.length;
      const tools = createPatchsmithTools(identity, identity.subjectId);
      assert.ok(tools);
      toolSets.push(tools);
      assert.deepEqual(Object.keys(tools), [
        "patchsmith_list_apps",
        "patchsmith_create_app",
        "patchsmith_edit_app",
      ]);
      assert.equal(
        requests.length,
        start,
        "Creating tools must not open a connection or discover tools",
      );
      const output = await run(
        tools.patchsmith_list_apps.execute!(
          { page: 1, pageSize: 100 },
          {
            toolCallId: "identity",
            messages: [],
            context: {},
          },
        ),
      );
      assert.deepEqual(output, {
        status: "completed",
        result: {
          isError: false,
          content: [{ type: "text", text: JSON.stringify({ apps: ["Workspace app"] }) }],
        },
      });
      for (const recorded of requests.slice(start)) {
        assert.deepEqual(recorded.context, {
          hostUrl: "https://forma.test/api/patchsmith",
          ...callerContext(identity),
        });
      }
    }
    const tools = toolSets[0];
    const usage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 10, text: 10, reasoning: undefined },
    };
    emitProgress = true;
    for (const isError of [false, true]) {
      toolError = isError;
      const reply = isError ? "App lookup failed." : "Found Workspace app.";
      const model = new MockLanguageModelV4({
        doStream: [
          {
            stream: simulateReadableStream({
              chunks: [
                {
                  type: "tool-call",
                  toolCallId: "apps",
                  toolName: "patchsmith_list_apps",
                  input: "{}",
                },
                { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
              ],
            }),
          },
          {
            stream: simulateReadableStream({
              chunks: [
                { type: "text-start", id: "answer" },
                { type: "text-delta", id: "answer", delta: reply },
                { type: "text-end", id: "answer" },
                { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
              ],
            }),
          },
        ],
      });
      let saved: UIMessage[] = [];
      const response = await createAgentUIStreamResponse({
        agent: createCrmAgent(
          tenant,
          { page: "/", date: "2026-10-15", timeZone: "UTC" },
          model,
          tools,
        ),
        uiMessages: [
          { id: "legacy-user", role: "user", parts: [{ type: "text", text: "List my apps" }] },
          {
            id: "legacy-assistant",
            role: "assistant",
            parts: [
              {
                type: "dynamic-tool",
                toolName: "patchsmith_list_apps",
                toolCallId: "legacy",
                state: "output-available",
                input: {},
                output: { isError: false, content: [{ type: "text", text: "Legacy app list" }] },
              },
            ],
          },
          { id: "user", role: "user", parts: [{ type: "text", text: "Refresh my apps" }] },
        ],
        onEnd: ({ messages }) => {
          saved = messages;
        },
      });
      const stream = await response.text();
      assert.ok(stream.includes('"toolName":"patchsmith_list_apps"'));
      assert.ok(
        stream.includes(isError ? '"type":"tool-output-error"' : '"type":"tool-output-available"'),
      );
      assert.ok(stream.includes(reply));
      assert.ok(!stream.includes("fixture-project-key"));
      assert.ok(
        stream.includes('"preliminary":true'),
        "Progress must stream as a preliminary result",
      );
      assert.ok(stream.includes("Building the app"));
      assert.equal(model.doStreamCalls.length, 2);
      const legacy = model.doStreamCalls[0].prompt
        .filter((message) => message.role === "tool")
        .flatMap((message) => message.content)
        .find((part) => part.type === "tool-result" && part.toolCallId === "legacy");
      assert.ok(
        JSON.stringify(legacy).includes("Legacy app list"),
        "Existing dynamic tool history must remain model-visible",
      );
      const toolResult = model.doStreamCalls[1].prompt
        .filter((message) => message.role === "tool")
        .flatMap((message) => message.content)
        .find((part) => part.type === "tool-result" && part.toolCallId === "apps");
      assert.ok(toolResult?.type === "tool-result");
      assert.deepEqual(
        toolResult.output,
        isError
          ? { type: "error-text", value: "Error: App lookup failed." }
          : {
              type: "json",
              value: {
                status: "completed",
                result: {
                  isError: false,
                  content: [{ type: "text", text: JSON.stringify({ apps: ["Workspace app"] }) }],
                },
              },
            },
        "The adapter must expose results and failures to the model",
      );
      assert.ok(saved.at(-1)?.parts.some((part) => part.type === "tool-patchsmith_list_apps"));
      assert.deepEqual(requests.at(-1)?.context, {
        hostUrl: "https://forma.test/api/patchsmith",
        ...callerContext(tenant),
      });
    }
    emitProgress = false;
    toolError = false;
    for (const call of [
      tools.patchsmith_create_app.execute!(
        { name: "Todo", prompt: "Build a todo app", scope: "workspace" },
        { toolCallId: "create", messages: [], context: {} },
      ),
      tools.patchsmith_edit_app.execute!(
        { appId: buildResult.appId, prompt: "Add filters", threadId: buildResult.threadId },
        { toolCallId: "edit", messages: [], context: {} },
      ),
    ]) {
      const output = await run(call);
      assert.ok(output && typeof output === "object" && "result" in output);
      assert.deepEqual(
        (output.result as { structuredContent: unknown }).structuredContent,
        buildResult,
        "App and conversation IDs must survive the adapter result envelope",
      );
    }
    holdCall = true;
    const started = new Promise<void>((resolve) => {
      callStarted = resolve;
    });
    const cancelled = new Promise<void>((resolve) => {
      callCancelled = resolve;
    });
    const abort = new AbortController();
    toolError = false;
    const pending = toolSets[1].patchsmith_create_app.execute!(
      { name: "Test app", prompt: "Build a todo app", scope: "workspace" },
      {
        toolCallId: "cancel",
        messages: [],
        context: {},
        abortSignal: abort.signal,
      },
    );
    const rejected = assert.rejects(run(pending));
    await started;
    abort.abort();
    await rejected;
    await cancelled;
    holdCall = false;

    failTransport = true;
    const start = requests.length;
    await assert.rejects(
      run(
        tools.patchsmith_list_apps.execute!(
          { page: 1, pageSize: 100 },
          {
            toolCallId: "failed",
            messages: [],
            context: {},
          },
        ),
      ),
    );
    assert.equal(requests.length, start + 1, "Failed calls must not be replayed");
    failTransport = false;
    controller.abort();
    const beforeAbort = requests.length;
    await assert.rejects(
      run(
        tools.patchsmith_list_apps.execute!(
          { page: 1, pageSize: 100 },
          {
            toolCallId: "aborted",
            messages: [],
            context: {},
            abortSignal: controller.signal,
          },
        ),
      ),
    );
    assert.equal(requests.length, beforeAbort, "An aborted call must not contact Patchsmith");
    assert.ok(requests.every(({ method }) => method !== "tools/list"));

    const interrupted = finishAgentMessages(
      [
        {
          id: "interrupted",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "patchsmith_create_app",
              toolCallId: "pending",
              state: "input-available",
              input: {},
            },
            {
              type: "tool-patchsmith_create_app",
              toolCallId: "progress",
              state: "output-available",
              preliminary: true,
              input: {},
              output: { status: "running", progress: { progress: 1 } },
            },
            {
              type: "dynamic-tool",
              toolName: "patchsmith_list_apps",
              toolCallId: "done",
              state: "output-available",
              input: {},
              output: {},
            },
          ],
        },
      ],
      true,
    );
    assert.ok(
      !interrupted[0].parts.some((part) => "toolCallId" in part && part.toolCallId === "pending"),
    );
    assert.ok(
      interrupted[0].parts.some((part) => "toolCallId" in part && part.toolCallId === "done"),
    );
    assert.ok(
      !interrupted[0].parts.some((part) => "toolCallId" in part && part.toolCallId === "progress"),
      "Interrupted progress is not a completed result",
    );
    assert.ok(AGENT_TIMEOUT_MS < 300000);
    console.log(
      "PASS: Patchsmith AI SDK tools, scoped auth, host metadata, no discovery, streamed progress, build/edit IDs, legacy history, cancellation, interrupted progress cleanup, and model-visible errors.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PATCHSMITH_PROJECT_KEY;
    else process.env.PATCHSMITH_PROJECT_KEY = originalKey;
    if (originalOrigin === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = originalOrigin;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    server.closeAllConnections();
    server.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
