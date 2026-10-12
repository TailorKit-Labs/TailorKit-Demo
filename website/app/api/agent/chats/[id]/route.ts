import { z } from "zod";
import { requireTenant } from "@/lib/workspace";
import { loadAgentChat } from "@/lib/agents/agent-chat-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return new Response("Your session expired. Refresh the page to reconnect your workspace.", {
      status: 401,
    });
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Chat not found.", { status: 404 });
  const chat = await loadAgentChat(tenant.id, id);
  return chat
    ? Response.json(chat, { headers: { "Cache-Control": "private, no-store" } })
    : new Response("Chat not found.", { status: 404 });
}
