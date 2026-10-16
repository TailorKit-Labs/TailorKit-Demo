import { randomUUID } from "node:crypto";
import { consumeStream, createAgentUIStream, type UIMessageChunk } from "ai";
import { ORPCError, streamToAsyncIteratorObject } from "@orpc/server";
import { checkBotId } from "botid/server";
import { z } from "zod";
import { protectedProcedure } from "./base";
import { createCrmAgent } from "../lib/agents/crm-agent";
import type { connectTailorKitTools as connectTools } from "../lib/agents/tailorkit-tools";
import { AGENT_TIMEOUT_MS } from "../lib/agents/agent-limits";
import { agentRequest } from "../lib/agents/agent-request";
import { AGENT_BOT_CHECK_LEVEL } from "../lib/agents/agent-protection";
import { beginAgentChat, ChatConflict, finishAgentMessages, saveAgentChat } from "./chats";
import { agentIpKey, reserveAgentTokens, pruneAgentBuckets } from "../lib/agents/agent-rate-limit";

export const agentChat = protectedProcedure
  .input(agentRequest)
  .errors({ TOO_MANY_REQUESTS: { data: z.object({ retryAfter: z.number() }) } })
  .handler(
    async ({ input, context, errors, signal }): Promise<AsyncIteratorObject<UIMessageChunk>> => {
      // Inference requires HTTP request identity and a response-lifetime hook.
      // Direct server/tool clients cannot bypass the browser bot check or IP budget.
      const { request, afterResponse, tenant } = context;
      if (!request || !afterResponse) throw new ORPCError("FORBIDDEN");
      // On Vercel, the SDK resolves the current OIDC token from trusted request
      // context. An environment-variable-only check would incorrectly block it.
      if (
        process.env.VERCEL !== "1" &&
        !process.env.AI_GATEWAY_API_KEY &&
        !process.env.VERCEL_OIDC_TOKEN &&
        !process.env.VERCEL_OIDC_TOKEN_FILE
      ) {
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "The agent is not connected yet. Please try again once it has been set up.",
        });
      }
      let admission;
      try {
        admission = await reserveAgentTokens(agentIpKey(request));
      } catch (error) {
        console.error("Agent rate-limit check failed:", error);
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "The agent is temporarily unavailable. Please try again.",
        });
      }
      if (!admission.allowed) {
        const message =
          admission.reason === "burst"
            ? "Too many messages from this network. Please wait a minute and try again."
            : "This network has used its demo allowance. Please try again after the five-hour bucket resets.";
        context.responseHeaders?.set("Retry-After", String(admission.retryAfter));
        throw errors.TOO_MANY_REQUESTS({ message, data: { retryAfter: admission.retryAfter } });
      }
      const { reservation } = admission;
      let tokenUsage: number | undefined;
      let streamConsumption: Promise<void> | undefined;
      let tailorkit: Awaited<ReturnType<typeof connectTools>>;
      afterResponse(async () => {
        // Drain on the server so disconnects still run persistence callbacks. The
        // request signal still cancels model generation and tool execution.
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
          await reservation.settle(tokenUsage);
          await pruneAgentBuckets();
        } catch (error) {
          // Failed settlement keeps the reservation charged until the bucket resets.
          console.error("Agent usage settlement failed:", error);
        }
      });
      // Limit starts before paid bot analysis. Rejected bots keep their start
      // charge, but get the unused model-token reservation back.
      tokenUsage = 0;
      try {
        const verification = await checkBotId({
          advancedOptions: { checkLevel: AGENT_BOT_CHECK_LEVEL },
          developmentOptions: {
            isDevelopment: process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1",
          },
        });
        if (verification.isBot)
          throw new ORPCError("FORBIDDEN", {
            message: "This request could not be verified. Please use the app to send your message.",
          });
      } catch (error) {
        if (error instanceof ORPCError) throw error;
        console.error("Agent bot verification failed:", error);
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "The agent could not verify this request. Please try again.",
        });
      }
      let chatTurn;
      try {
        chatTurn = await beginAgentChat(tenant.id, input.chatId, input.messages);
      } catch (error) {
        tokenUsage = 0;
        if (error instanceof ChatConflict)
          throw new ORPCError(
            error.status === 404
              ? "NOT_FOUND"
              : error.status === 413
                ? "PAYLOAD_TOO_LARGE"
                : error.status === 409
                  ? "CONFLICT"
                  : "BAD_REQUEST",
            {
              message: error.message,
            },
          );
        console.error("Agent chat could not be saved:", error);
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "This chat could not be saved. Please try again.",
        });
      }
      try {
        tokenUsage = undefined;
        const { connectTailorKitTools } = await import("../lib/agents/tailorkit-tools");
        tailorkit = await connectTailorKitTools(tenant, signal ?? request.signal);
        const stream = await createAgentUIStream({
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
          generateMessageId: randomUUID,
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
          abortSignal: signal ?? request.signal,
          timeout: AGENT_TIMEOUT_MS,
          onError: () =>
            "The agent could not finish this request. Please try again. Check the page before repeating a creation.",
        });
        const [clientStream, serverStream] = stream.tee();
        streamConsumption = consumeStream({ stream: serverStream });
        return streamToAsyncIteratorObject(clientStream);
      } catch (error) {
        console.error("Agent request failed:", error);
        await saveAgentChat(chatTurn, chatTurn.messages, true);
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "The agent could not start this request. Please try again.",
        });
      }
    },
  );
