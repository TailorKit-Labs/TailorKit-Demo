import "./test-env";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { Chat } from "@ai-sdk/react";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db, pool } from "../lib/drizzle";
import { agentChats, user } from "../lib/schema";
import { AGENT_BOT_CHECK_LEVEL } from "../lib/agents/agent-protection";
import { createAgentTransport } from "../lib/agents/agent-transport";
import { loadAgentChat } from "../routers/chats";
import { handleRpcRequest } from "../routers/handler";
import { tenantFromHeaders, verifiedWorkspaceContext } from "../routers/context";
import type { router } from "../routers";
import { router as serverRouter } from "../routers";
import type { CrmAgentMessage } from "../lib/agents/crm-agent";
import { provisionForUser } from "./test-provision";

const origin = "http://localhost:3000";
const hasCode = (code: string) => (error: unknown) =>
  error instanceof ORPCError && error.code === code;

async function main() {
  const env = process.env as Record<string, string | undefined>;
  const savedEnv = {
    VERCEL: env.VERCEL,
    AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY,
    TAILORKIT_PROJECT_KEY: env.TAILORKIT_PROJECT_KEY,
  };
  const originalFetch = globalThis.fetch;
  const contextSymbol = Symbol.for("@vercel/request-context");
  const globals = globalThis as unknown as Record<symbol, unknown>;
  const originalContext = globals[contextSymbol];
  const requests = new AsyncLocalStorage<Request>();
  const cleanup: (() => Promise<void>)[] = [];
  let userId: string | undefined;
  let botMode: "human" | "bot" | "unavailable" = "human";
  let botChecks = 0;
  let modelCalls = 0;
  let holdModel = false;
  let modelAborted = false;
  const runCleanup = async () => {
    for (const work of cleanup.splice(0)) await work();
  };
  try {
    const signIn = await auth.api.signInAnonymous({ asResponse: true });
    const payload = await signIn.json();
    userId = payload.user.id;
    const cookie = signIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const client = createORPCClient<RouterClient<typeof router>>(
      new RPCLink({
        origin,
        url: "/rpc",
        headers: { origin, cookie },
        fetch: async (url, init) => {
          const request = new Request(url, init);
          const response = await requests.run(request, () =>
            handleRpcRequest(request, (work) => cleanup.push(work)),
          );
          return response;
        },
      }),
    );
    await client.workspace.provision();
    await provisionForUser(payload.user.id);
    const tenant = await tenantFromHeaders(new Headers({ cookie }));
    env.VERCEL = "1";
    env.AI_GATEWAY_API_KEY = "test-key-no-provider-spend";
    delete env.TAILORKIT_PROJECT_KEY;
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
    assert.equal(AGENT_BOT_CHECK_LEVEL, "deepAnalysis");
    globalThis.fetch = async (url, init) => {
      const requestUrl = url instanceof Request ? url.url : url.toString();
      if (requestUrl.startsWith("https://api.vercel.com/bot-protection/")) {
        botChecks++;
        assert.equal(typeof init?.body, "string");
        assert.equal(JSON.parse(init!.body as string).forceCheckLevel, AGENT_BOT_CHECK_LEVEL);
        if (botMode === "unavailable") throw new Error("Simulated BotID outage");
        return Response.json({ isBot: botMode === "bot", isVerifiedBot: false, bypassed: false });
      }
      assert.ok(
        requestUrl.startsWith("https://ai-gateway.vercel.sh/"),
        `Unexpected external request: ${requestUrl}`,
      );
      modelCalls++;
      const chunks = [
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "answer" },
        { type: "text-delta", id: "answer", delta: "Hello from oRPC." },
      ];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = (chunk: unknown) =>
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
          chunks.forEach(emit);
          if (holdModel) {
            init?.signal?.addEventListener(
              "abort",
              () => {
                modelAborted = true;
                controller.error(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          } else {
            emit({ type: "text-end", id: "answer" });
            emit({
              type: "finish",
              finishReason: { unified: "stop" },
              usage: {
                inputTokens: { total: 30000 },
                outputTokens: { total: 30000 },
              },
            });
            controller.close();
          }
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    };
    const input = () => ({
      chatId: crypto.randomUUID(),
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user" as const,
          parts: [{ type: "text" as const, text: "Hello" }],
        },
      ],
    });
    const transport = createAgentTransport(client.agent.chat);
    const first = input();
    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: "sdk-id",
      messageId: undefined,
      messages: first.messages,
      body: { chatId: first.chatId, page: "/contacts", timeZone: "UTC" },
      abortSignal: undefined,
    });
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    await runCleanup();
    assert.ok(
      chunks.some((chunk) => chunk.type === "text-delta" && chunk.delta === "Hello from oRPC."),
    );
    assert.equal((await loadAgentChat(tenant.id, first.chatId))?.messages.length, 2);
    assert.equal(modelCalls, 1);
    assert.equal(botChecks, 1);

    const direct = createRouterClient(serverRouter, {
      context: verifiedWorkspaceContext(tenant.id),
    });
    await assert.rejects(() => direct.agent.chat(input()), hasCode("FORBIDDEN"));
    assert.equal(botChecks, 1, "Direct clients cannot bypass request protection");

    botMode = "bot";
    const rejected = input();
    await assert.rejects(() => client.agent.chat(rejected), hasCode("FORBIDDEN"));
    await runCleanup();
    assert.equal(await loadAgentChat(tenant.id, rejected.chatId), null);
    assert.equal(modelCalls, 1);
    botMode = "unavailable";
    await assert.rejects(() => client.agent.chat(input()), hasCode("SERVICE_UNAVAILABLE"));
    await runCleanup();
    assert.equal(modelCalls, 1, "Verification failures must fail closed");

    botMode = "human";
    holdModel = true;
    const controller = new AbortController();
    const cancelled = input();
    const interrupted = await transport.sendMessages({
      trigger: "submit-message",
      chatId: "sdk-id",
      messageId: undefined,
      messages: cancelled.messages,
      body: { chatId: cancelled.chatId },
      abortSignal: controller.signal,
    });
    const reader = interrupted.getReader();
    while (true) {
      const { value, done } = await reader.read();
      assert.ok(!done, "Expected text before aborting");
      if (value?.type === "text-delta") break;
    }
    controller.abort();
    try {
      while (!(await reader.read()).done) {}
    } catch {
      /* Expected client abort. */
    }
    await runCleanup();
    assert.ok(modelAborted, "Client cancellation must reach model fetch");
    assert.ok(await loadAgentChat(tenant.id, cancelled.chatId), "Interrupted chat must persist");
    holdModel = false;
    const checksBeforeBurst = botChecks;
    const callsBeforeBurst = modelCalls;
    for (let i = 0; i < 6; i++) {
      const accepted = await client.agent.chat(input());
      for await (const _chunk of accepted) {
        /* Drain. */
      }
      await runCleanup();
    }
    assert.equal(botChecks, checksBeforeBurst + 6, "Deep Analysis must verify every request");
    assert.equal(modelCalls, callsBeforeBurst + 6, "Verified humans have no IP or token quota");
    const checksBeforeUnauthenticated = botChecks;
    const unauthenticated = createORPCClient<RouterClient<typeof router>>(
      new RPCLink({
        origin,
        url: "/rpc",
        headers: { origin },
        fetch: (url, init) =>
          handleRpcRequest(new Request(url, init), (work) => cleanup.push(work)),
      }),
    );
    await assert.rejects(() => unauthenticated.agent.chat(input()), hasCode("UNAUTHORIZED"));
    assert.equal(botChecks, checksBeforeUnauthenticated);

    // Exercise the same SDK state as useChat, including client-side fallback IDs.
    const chatId = crypto.randomUUID();
    const chat = new Chat<CrmAgentMessage>({ transport });
    const send = async (current: Chat<CrmAgentMessage>, text: string) => {
      await current.sendMessage({ text }, { body: { chatId } });
      await runCleanup();
      assert.equal(current.error, undefined);
      assert.equal(current.status, "ready");
      const saved = await loadAgentChat(tenant.id, chatId);
      assert.ok(saved);
      assert.ok(saved.messages.every((message) => message.id.length > 0));
      assert.deepEqual(
        saved.messages.map((message) => message.id),
        current.messages.map((message) => message.id),
        "Streamed and persisted message IDs must match before a follow-up",
      );
    };
    await send(chat, "Show my deals");
    await send(chat, "Create a new contract for Alfie Jones");
    const reopened = new Chat<CrmAgentMessage>({
      transport,
      messages: (await client.chats.get({ id: chatId })).messages,
    });
    await send(reopened, "Continue after reopening");
    assert.equal(reopened.messages.length, 6);
    await db
      .update(agentChats)
      .set({
        messages: reopened.messages.map((message) =>
          message.role === "assistant" ? { ...message, id: "" } : message,
        ),
      })
      .where(eq(agentChats.id, chatId));
    const recovered = new Chat<CrmAgentMessage>({
      transport,
      messages: (await client.chats.get({ id: chatId })).messages,
    });
    await send(recovered, "Continue a chat saved with missing reply IDs");
    assert.equal(recovered.messages.length, 8);
    console.log(
      "PASS: actual agent oRPC HTTP + AI SDK transport, stable streamed/persisted IDs, follow-ups, reopening, Deep Analysis on every request, no IP/token quotas, persistence, bot rejection/outage, direct-client guard, and cancellation.",
    );
  } finally {
    await runCleanup();
    globalThis.fetch = originalFetch;
    if (originalContext === undefined) delete globals[contextSymbol];
    else globals[contextSymbol] = originalContext;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    if (userId) await db.delete(user).where(eq(user.id, userId));
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
