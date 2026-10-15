import { randomUUID } from "node:crypto";
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

export class ChatConflict extends Error {
  constructor(
    message: string,
    public readonly status: number = 409,
  ) {
    super(message);
  }
}

function serializeChat(chat: typeof agentChats.$inferSelect): SavedAgentChat {
  return {
    id: chat.id,
    title: chat.title,
    updatedAt: chat.updatedAt.toISOString(),
    messages: chat.messages as CrmAgentMessage[],
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

// The database owns previous replies and tool results. Only accept the new user
// message from the client, and reject stale tabs instead of overwriting history.
export async function beginAgentChat(
  tenantId: string,
  id: string,
  clientMessages: z.infer<typeof agentRequest>["messages"],
) {
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
    throw new ChatConflict("Send a text message to continue this chat.", 400);
  const message: UIMessage = {
    id: incoming.id,
    role: "user",
    parts: [{ type: "text", text: incoming.parts[0].text }],
  };
  const title = incoming.parts[0].text.trim().slice(0, 120);
  const turnId = randomUUID();
  const now = new Date();
  return db.transaction(async (tx) => {
    await tx
      .insert(agentChats)
      .values({ id, tenantId, title, messages: [] })
      .onConflictDoNothing({ target: agentChats.id });
    const [chat] = await tx.select().from(agentChats).where(eq(agentChats.id, id)).for("update");
    if (chat.tenantId !== tenantId) throw new ChatConflict("Chat not found.", 404);
    if (chat.activeTurnId && chat.activeUntil && chat.activeUntil > now)
      throw new ChatConflict(
        "This chat is still responding. Please wait, then reopen it from history.",
      );
    const previousIds = clientMessages.slice(0, -1).map((previous) => previous.id);
    if (
      JSON.stringify(previousIds) !==
        JSON.stringify(chat.messages.map((previous) => previous.id)) ||
      chat.messages.some((previous) => previous.id === message.id)
    )
      throw new ChatConflict(
        "This chat has changed. Reopen it from history before sending another message.",
      );
    const messages = [...chat.messages, message];
    if (messages.length > 20 || Buffer.byteLength(JSON.stringify(messages)) > 60000)
      throw new ChatConflict("This conversation is too long. Start a new chat.", 413);
    await tx
      .update(agentChats)
      .set({
        messages,
        activeTurnId: turnId,
        activeUntil: new Date(now.getTime() + 90000),
        updatedAt: now,
      })
      .where(eq(agentChats.id, id));
    return { id, tenantId, turnId, messages };
  });
}

export type AgentChatTurn = Awaited<ReturnType<typeof beginAgentChat>>;

export async function saveAgentChat(turn: AgentChatTurn, messages: UIMessage[], finished = false) {
  await db
    .update(agentChats)
    .set({
      messages,
      updatedAt: new Date(),
      ...(finished ? { activeTurnId: null, activeUntil: null } : {}),
    })
    .where(
      and(
        eq(agentChats.id, turn.id),
        eq(agentChats.tenantId, turn.tenantId),
        eq(agentChats.activeTurnId, turn.turnId),
      ),
    );
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
                part.type.startsWith("tool-") &&
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
