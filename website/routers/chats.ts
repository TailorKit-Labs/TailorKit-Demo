import type { UIMessage } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../lib/drizzle";
import { agentChats } from "../lib/schema";
import type { AgentHistory, SavedAgentChat } from "../lib/agents/agent-chat-types";
import type { CrmAgentMessage } from "../lib/agents/crm-agent";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "./base";
import type { agentRequest } from "../lib/agents/agent-request";
import { AGENT_CHAT_MAX_INPUT_BYTES } from "../lib/agents/agent-limits";

// Old streams saved empty assistant IDs. Keep repairs stable across history reads
// and persist them with the next admitted turn, without changing valid IDs.
function withMessageIds(chatId: string, messages: UIMessage[]): UIMessage[] {
  const usedIds = new Set(messages.map((message) => message.id).filter(Boolean));
  return messages.map((message, index) => {
    if (message.id) return message;
    const base = `recovered-${chatId}-${index}`;
    let id = base;
    for (let suffix = 1; usedIds.has(id); suffix++) id = `${base}-${suffix}`;
    usedIds.add(id);
    return { ...message, id };
  });
}

function serializeChat(chat: typeof agentChats.$inferSelect): SavedAgentChat {
  return {
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt.toISOString(),
    messages: withMessageIds(chat.id, chat.messages) as CrmAgentMessage[],
  };
}

export async function loadAgentChat(tenantId: string, id: string) {
  const [chat] = await db
    .select()
    .from(agentChats)
    .where(and(eq(agentChats.tenantId, tenantId), eq(agentChats.id, id)));
  return chat ? serializeChat(chat) : null;
}

export async function loadAgentHistory(tenantId: string): Promise<AgentHistory> {
  const chats = await db
    .select({ id: agentChats.id, title: agentChats.title, updatedAt: agentChats.updatedAt })
    .from(agentChats)
    .where(eq(agentChats.tenantId, tenantId))
    .orderBy(desc(agentChats.updatedAt), desc(agentChats.id))
    .limit(20);
  return {
    chats: chats.map((chat) => ({ ...chat, updatedAt: chat.updatedAt.toISOString() })),
    latest: chats[0] ? await loadAgentChat(tenantId, chats[0].id) : null,
  };
}

export type AgentChatTurn = { id: string; tenantId: string; messages: UIMessage[] };

// Keep previous replies and tool results on the server; accept only the new user message.
export async function beginAgentChat(
  tenantId: string,
  id: string,
  clientMessages: z.infer<typeof agentRequest>["messages"],
): Promise<AgentChatTurn> {
  const incoming = clientMessages.at(-1);
  if (
    !incoming ||
    incoming.role !== "user" ||
    incoming.parts.length !== 1 ||
    incoming.parts[0].type !== "text" ||
    typeof incoming.parts[0].text !== "string" ||
    !incoming.parts[0].text.trim() ||
    incoming.parts[0].text.length > 4000
  )
    throw new ORPCError("BAD_REQUEST", { message: "Send a text message to continue this chat." });
  const message: UIMessage = {
    id: incoming.id,
    role: "user",
    parts: [{ type: "text", text: incoming.parts[0].text }],
  };
  const title = incoming.parts[0].text.trim().slice(0, 120);
  await db
    .insert(agentChats)
    .values({ id, tenantId, title, messages: [] })
    .onConflictDoNothing({ target: agentChats.id });
  const [chat] = await db
    .select()
    .from(agentChats)
    .where(and(eq(agentChats.tenantId, tenantId), eq(agentChats.id, id)));
  if (!chat) throw new ORPCError("NOT_FOUND", { message: "Chat not found." });
  const messages = [...withMessageIds(chat.id, chat.messages), message];
  // Tool results are server-generated and may contain an entire app build.
  // Apply the input budget to user messages so a completed build cannot lock
  // its own conversation out of subsequent turns.
  const userMessages = messages.filter((entry) => entry.role === "user");
  if (Buffer.byteLength(JSON.stringify(userMessages)) > AGENT_CHAT_MAX_INPUT_BYTES)
    throw new ORPCError("PAYLOAD_TOO_LARGE", {
      message: "This chat has reached its 1 MB input limit. Start a new chat.",
    });
  const turn = { id, tenantId, messages };
  await saveAgentChat(turn, messages);
  return turn;
}

export async function saveAgentChat(turn: AgentChatTurn, messages: UIMessage[]) {
  await db
    .update(agentChats)
    .set({
      messages,
      updatedAt: new Date(),
    })
    .where(and(eq(agentChats.id, turn.id), eq(agentChats.tenantId, turn.tenantId)));
}

// Interrupted calls cannot be replayed as unfinished tool requests in the next
// turn. Keep completed results and partial text, and make the interruption clear.
export function finishAgentMessages(messages: UIMessage[], interrupted: boolean): UIMessage[] {
  if (!interrupted) return messages;
  return messages.map((message, index) => {
    if (index !== messages.length - 1 || message.role !== "assistant") return message;
    return {
      ...message,
      parts: [
        ...message.parts
          .filter(
            (part) =>
              !(
                (part.type.startsWith("tool-") || part.type === "dynamic-tool") &&
                "state" in part &&
                (part.state === "input-streaming" || part.state === "input-available")
              ),
          )
          .map((part) =>
            part.type === "text" || part.type === "reasoning"
              ? { ...part, state: "done" as const }
              : part,
          ),
        {
          type: "text" as const,
          text: "This response stopped before finishing. Check your workspace before repeating a change.",
        },
      ],
    };
  });
}

export const getChat = protectedProcedure
  .input(z.object({ id: z.uuid() }))
  .handler(async ({ input, context }) => {
    const chat = await loadAgentChat(context.tenant.id, input.id);
    if (!chat) throw new ORPCError("NOT_FOUND", { message: "Chat not found." });
    return chat;
  });

export const listChats = protectedProcedure.handler(({ context }) =>
  loadAgentHistory(context.tenant.id),
);
