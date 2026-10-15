import { consumeStream, createAgentUIStreamResponse } from "ai";
import { after } from "next/server";
import { checkBotId } from "botid/server";
import { requireTenant } from "@/lib/workspace";
import { createCrmAgent } from "@/lib/agents/crm-agent";
import { connectTailorKitTools } from "@/lib/agents/tailorkit-tools";
import { AGENT_TIMEOUT_MS } from "@/lib/agents/agent-limits";
import { agentRequest, isSameOriginRequest } from "@/lib/agents/agent-request";
import { beginAgentChat, ChatConflict, finishAgentMessages, saveAgentChat } from "@/routers/chats";
import {
  agentIpKey,
  reserveAgentTokens,
  settleAgentTokens,
  pruneAgentBuckets,
} from "@/lib/agents/agent-rate-limit";

export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return new Response("This request is not allowed.", { status: 403 });
  try {
    const verification = await checkBotId({
      advancedOptions: { checkLevel: "basic" },
      developmentOptions: {
        isDevelopment: process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1",
      },
    });
    if (verification.isBot)
      return new Response(
        "This request could not be verified. Please use the app to send your message.",
        { status: 403 },
      );
  } catch (error) {
    console.error("Agent bot verification failed:", error);
    return new Response("The agent could not verify this request. Please try again.", {
      status: 503,
    });
  }
  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return new Response("Your session expired. Refresh the page to reconnect your workspace.", {
      status: 401,
    });
  }

  const text = await request.text();
  if (Buffer.byteLength(text) > 60000)
    return new Response("This conversation is too long. Start a new chat.", { status: 413 });
  let input;
  try {
    input = agentRequest.parse(JSON.parse(text));
  } catch {
    return new Response("This message could not be read. Start a new chat and try again.", {
      status: 400,
    });
  }

  // On Vercel, the SDK resolves the current OIDC token from trusted request
  // context. An environment-variable-only check would incorrectly block it.
  if (
    process.env.VERCEL !== "1" &&
    !process.env.AI_GATEWAY_API_KEY &&
    !process.env.VERCEL_OIDC_TOKEN &&
    !process.env.VERCEL_OIDC_TOKEN_FILE
  ) {
    return new Response(
      "The agent is not connected yet. Please try again once it has been set up.",
      { status: 503 },
    );
  }
  let admission;
  try {
    admission = await reserveAgentTokens(agentIpKey(request));
  } catch (error) {
    console.error("Agent rate-limit check failed:", error);
    return new Response("The agent is temporarily unavailable. Please try again.", { status: 503 });
  }
  if (!admission.allowed) {
    const message =
      admission.reason === "burst"
        ? "Too many messages from this network. Please wait a minute and try again."
        : "This network has used its demo allowance. Please try again after the five-hour bucket resets.";
    return new Response(message, {
      status: 429,
      headers: { "Retry-After": String(admission.retryAfter) },
    });
  }
  const { reservation } = admission;
  let tokenUsage: number | undefined;
  let streamConsumption: Promise<void> | undefined;
  let tailorkit: Awaited<ReturnType<typeof connectTailorKitTools>>;
  after(async () => {
    // Drain on the server so disconnects still run persistence callbacks, while
    // request.signal continues to cancel model generation and tool execution.
    try {
      await streamConsumption;
    } catch (error) {
      console.error("Agent stream consumption failed:", error);
    }
    try {
      await tailorkit?.close();
    } catch {
      console.error("TailorKit MCP connection could not be closed.");
    }
    try {
      await settleAgentTokens(reservation, tokenUsage);
      await pruneAgentBuckets();
    } catch (error) {
      // The reservation remains charged if accounting fails; its lease expires.
      console.error("Agent usage settlement failed:", error);
    }
  });
  let chatTurn;
  try {
    chatTurn = await beginAgentChat(tenant.id, input.chatId, input.messages);
  } catch (error) {
    tokenUsage = 0;
    if (error instanceof ChatConflict) return new Response(error.message, { status: error.status });
    console.error("Agent chat could not be saved:", error);
    return new Response("This chat could not be saved. Please try again.", { status: 503 });
  }
  try {
    tailorkit = await connectTailorKitTools(tenant, request.signal);
    return await createAgentUIStreamResponse({
      agent: createCrmAgent(
        tenant,
        {
          page: input.page,
          date: input.date ?? new Date().toISOString().slice(0, 10),
          timeZone: input.timeZone,
        },
        undefined,
        {
          tokens: reservation.tokens,
          onUsage: (tokens) => {
            tokenUsage = tokens;
          },
        },
        tailorkit?.tools,
      ),
      uiMessages: chatTurn.messages,
      consumeSseStream: ({ stream }) => {
        streamConsumption = consumeStream({ stream });
      },
      onUIMessageStepEnd: ({ messages }) => saveAgentChat(chatTurn, messages),
      onEnd: ({ messages, outcome, isAborted, isCancelled }) =>
        saveAgentChat(
          chatTurn,
          finishAgentMessages(
            messages,
            isAborted || !!isCancelled || outcome.status !== "completed",
          ),
          true,
        ),
      abortSignal: request.signal,
      timeout: AGENT_TIMEOUT_MS,
      onError: () =>
        "The agent could not finish this request. Please try again. Check the page before repeating a creation.",
    });
  } catch (error) {
    console.error("Agent request failed:", error);
    await saveAgentChat(chatTurn, chatTurn.messages, true);
    return new Response("The agent could not start this request. Please try again.", {
      status: 500,
    });
  }
}
