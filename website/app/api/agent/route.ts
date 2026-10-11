import { createAgentUIStreamResponse } from "ai";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/workspace";
import { createCrmAgent } from "@/lib/agents/crm-agent";
import { agentRequest, isSameOriginRequest } from "@/lib/agents/agent-request";

export const maxDuration = 60;
const mutationTools = new Set(["createDeal", "moveDeal", "createTask", "setTaskCompleted"]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return new Response("This request is not allowed.", { status: 403 });
  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return new Response("Your session expired. Refresh the page to reconnect your workspace.", {
      status: 401,
    });
  }

  const text = await request.text();
  if (text.length > 200000)
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
  try {
    return await createAgentUIStreamResponse({
      agent: createCrmAgent(tenant, {
        page: input.page,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        timeZone: input.timeZone,
      }),
      uiMessages: input.messages,
      abortSignal: request.signal,
      onStepEnd: ({ toolResults }) => {
        if (toolResults.some((result) => mutationTools.has(result.toolName)))
          revalidatePath("/", "layout");
      },
      onError: () =>
        "The agent could not finish this request. Please try again. Check the page before repeating a creation.",
    });
  } catch (error) {
    console.error("Agent request failed:", error);
    return new Response("The agent could not start this request. Please try again.", {
      status: 500,
    });
  }
}
