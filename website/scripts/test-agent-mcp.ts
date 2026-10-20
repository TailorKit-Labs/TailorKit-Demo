import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createAgentUIStreamResponse, simulateReadableStream, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { createCrmAgent } from "../lib/agents/crm-agent";
import { finishAgentMessages } from "../routers/chats";
import { AGENT_TIMEOUT_MS } from "../lib/agents/agent-limits";
import { contract } from "../lib/tailorkit";

const originalFetch = globalThis.fetch;
const originalKey = process.env.TAILORKIT_PROJECT_KEY;
const originalOrigin = process.env.BETTER_AUTH_URL;
const originalVercelEnv = process.env.VERCEL_ENV;
type CallerContext = { subjectId: string; scopes: { workspace: { workspaceId: string } } };
const requests: { method: string; context: CallerContext }[] = [];
const callerContext = (tenant: { id: string; subjectId: string }): CallerContext => ({
  subjectId: tenant.subjectId,
  scopes: { workspace: { workspaceId: tenant.id } },
});
let failDiscovery = false;
let holdCall = false;
let toolError = false;
let callStarted: (() => void) | undefined;
let callCancelled: (() => void) | undefined;
const definition = (name: string) => ({
  name,
  description: "List or build workspace apps.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
});

async function run(result: unknown) {
  const resolved = await result;
  if (resolved && typeof resolved === "object" && Symbol.asyncIterator in resolved) {
    for await (const _part of resolved as AsyncIterable<unknown>) {
      // Tool execution may return a stream; consume it so errors surface.
    }
  }
  return resolved;
}

// A real HTTP endpoint speaking the stateless MCP version used by PatchSmith.
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
      Buffer.from(String(request.headers["x-tailorkit-context"]), "base64url").toString(),
    );
    assert.equal(context.hostUrl, "https://forma.test/api/tailorkit");
    let body = "";
    for await (const chunk of request) body += chunk;
    const message = JSON.parse(body);
    assert.equal(request.headers["mcp-protocol-version"], "2026-07-28", message.method);
    requests.push({ method: message.method, context });
    let result: Record<string, unknown>;
    switch (message.method) {
      case "server/discover":
        result = { supportedVersions: ["2026-07-28"], capabilities: { tools: {} } };
        break;
      case "tools/list":
        if (failDiscovery) {
          response.writeHead(503).end("Discovery unavailable");
          return;
        }
        result = message.params?.cursor
          ? { tools: [definition("create_app"), definition("edit_app")] }
          : { tools: [definition("list_apps")], nextCursor: "second-page" };
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
        assert.equal(message.params.name, "list_apps", "Prefix must not reach the MCP server");
        break;
      default:
        throw new Error(`Unexpected MCP method: ${message.method}`);
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result: { resultType: "complete", ...result },
      }),
    );
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
    assert.equal(url, "https://tailorkit.dev/api/platform/app-agent/mcp");
    return originalFetch(`http://127.0.0.1:${address.port}/mcp`, init);
  };
  process.env.TAILORKIT_PROJECT_KEY = "fixture-project-key";
  process.env.BETTER_AUTH_URL = "https://forma.test";
  delete process.env.VERCEL_ENV;
  const { connectTailorKitTools } = await import("../lib/agents/tailorkit-tools");
  const { tailorKit: host } = await import("../lib/tailorkit-server");
  const tenant = { id: "workspace-one", name: "Demo", subjectId: "user-one" };
  const controller = new AbortController();
  const connections: NonNullable<Awaited<ReturnType<typeof connectTailorKitTools>>>[] = [];
  try {
    delete process.env.TAILORKIT_PROJECT_KEY;
    assert.equal(
      await connectTailorKitTools(tenant, tenant.subjectId, controller.signal),
      undefined,
    );
    assert.equal(requests.length, 0, "Unconfigured CRM must not make MCP requests");
    process.env.TAILORKIT_PROJECT_KEY = "fixture-project-key";
    const metadata = await host.handler(new Request("https://forma.test/api/tailorkit/meta"), {
      authenticate: () => callerContext(tenant),
    });
    assert.equal(metadata.status, 200, "App builders must be able to read the host contract");
    const hostMetadata = await metadata.text();
    assert.ok(!hostMetadata.includes("fixture-project-key"));
    assert.ok(hostMetadata.includes('"contacts"'), "MCP must use the existing CRM host tools");
    assert.ok(hostMetadata.includes('"Button"'), "MCP must use the existing host components");
    assert.equal(host.contract, contract);
    const unauthorized = await host.handler(new Request("https://forma.test/api/tailorkit/apps"), {
      authenticate: () => null,
    });
    assert.equal(unauthorized.status, 401);

    for (const identity of [
      tenant,
      { ...tenant, id: "workspace-two" },
      { ...tenant, subjectId: "user-two" },
    ]) {
      const start: number = requests.length;
      const connection = await connectTailorKitTools(
        identity,
        identity.subjectId,
        controller.signal,
      );
      assert.ok(connection);
      connections.push(connection);
      assert.deepEqual(Object.keys(connection.tools), [
        "tailorkit_list_apps",
        "tailorkit_create_app",
        "tailorkit_edit_app",
      ]);
      for (const recorded of requests.slice(start)) {
        assert.deepEqual(recorded.context, {
          hostUrl: "https://forma.test/api/tailorkit",
          ...callerContext(identity),
        });
      }
    }
    const connection = connections[0];
    const usage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 10, text: 10, reasoning: undefined },
    };
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
                  toolName: "tailorkit_list_apps",
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
          connection.tools,
        ),
        uiMessages: [{ id: "user", role: "user", parts: [{ type: "text", text: "List my apps" }] }],
        onEnd: ({ messages }) => {
          saved = messages;
        },
      });
      const stream = await response.text();
      assert.ok(stream.includes('"dynamic":true'));
      assert.ok(stream.includes('"type":"tool-output-available"'));
      assert.ok(stream.includes(reply));
      assert.ok(!stream.includes("fixture-project-key"));
      assert.equal(model.doStreamCalls.length, 2);
      const toolResult = model.doStreamCalls[1].prompt
        .filter((message) => message.role === "tool")
        .flatMap((message) => message.content)
        .find((part) => part.type === "tool-result");
      assert.equal(toolResult?.output.type, "content");
      assert.ok(toolResult?.output.type === "content");
      assert.deepEqual(
        toolResult.output.value,
        [
          { type: "text", text: JSON.stringify({ isError }) },
          {
            type: "text",
            text: isError ? "App lookup failed." : JSON.stringify({ apps: ["Workspace app"] }),
          },
        ],
        "Model-visible MCP output must preserve error status and content",
      );
      assert.ok(saved.at(-1)?.parts.some((part) => part.type === "dynamic-tool"));
      assert.deepEqual(requests.at(-1)?.context, {
        hostUrl: "https://forma.test/api/tailorkit",
        ...callerContext(tenant),
      });
    }
    await connection.close();
    await assert.rejects(
      run(
        connection.tools.tailorkit_list_apps.execute!(
          {},
          {
            toolCallId: "closed",
            messages: [],
            context: {},
          },
        ),
      ),
      /closed/i,
    );

    holdCall = true;
    const started = new Promise<void>((resolve) => {
      callStarted = resolve;
    });
    const cancelled = new Promise<void>((resolve) => {
      callCancelled = resolve;
    });
    const abort = new AbortController();
    const pending = connections[1].tools.tailorkit_create_app.execute!(
      {},
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

    failDiscovery = true;
    await assert.rejects(connectTailorKitTools(tenant, tenant.subjectId, controller.signal));
    controller.abort();
    await assert.rejects(connectTailorKitTools(tenant, tenant.subjectId, controller.signal));

    const interrupted = finishAgentMessages(
      [
        {
          id: "interrupted",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "tailorkit_create_app",
              toolCallId: "pending",
              state: "input-available",
              input: {},
            },
            {
              type: "dynamic-tool",
              toolName: "tailorkit_list_apps",
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
    assert.ok(AGENT_TIMEOUT_MS < 300000);
    console.log(
      "PASS: scoped PatchSmith helper auth, host metadata, paginated HTTP MCP discovery, agent streaming, dynamic history, cancellation, failure handling, and client cleanup.",
    );
  } finally {
    await Promise.all(connections.map((connection) => connection.close()));
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TAILORKIT_PROJECT_KEY;
    else process.env.TAILORKIT_PROJECT_KEY = originalKey;
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
