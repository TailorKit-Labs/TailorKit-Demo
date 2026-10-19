import { AsyncLocalStorage } from "node:async_hooks";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { z } from "zod";

export type TailorKitProgress = { toolCallId: string; text: string };

const notification = z.object({
  method: z.literal("notifications/progress"),
  params: z.object({ progressToken: z.string(), message: z.string() }),
});
const agentEvent = z.object({
  chunk: z.object({ type: z.string(), delta: z.string().optional() }),
});

// The AI SDK's MCP client does not expose progress notifications. Intercept only
// progress in its request-scoped HTTP stream; leave protocol/auth/errors to it.
export function createTailorKitProgress(onProgress: (progress: TailorKitProgress) => void) {
  const calls = new AsyncLocalStorage<{ toolCallId: string }>();
  const fetchWithProgress: typeof fetch = async (input, init) => {
    const call = calls.getStore();
    if (!call || typeof init?.body !== "string") return fetch(input, init);
    const request = JSON.parse(init.body);
    if (request.method !== "tools/call") return fetch(input, init);
    const progressToken = crypto.randomUUID();
    request.params._meta = { ...request.params._meta, progressToken };
    const response = await fetch(input, { ...init, body: JSON.stringify(request) });
    if (
      !response.ok ||
      !response.body ||
      !response.headers.get("content-type")?.includes("text/event-stream")
    )
      return response;

    let text = "";
    const body = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
      .pipeThrough(
        new TransformStream({
          transform(event, controller) {
            if (!event.event || event.event === "message") {
              let parsed: unknown;
              try {
                parsed = JSON.parse(event.data);
              } catch {
                // Preserve invalid messages for the SDK's normal error handling.
              }
              const progress = notification.safeParse(parsed);
              if (progress.success) {
                if (
                  progress.data.params.progressToken === progressToken &&
                  !init?.signal?.aborted
                ) {
                  let value: unknown;
                  try {
                    value = JSON.parse(progress.data.params.message);
                  } catch {
                    // TailorKit progress carries JSON agent events.
                  }
                  const result = agentEvent.safeParse(value);
                  if (result.success) {
                    const { chunk } = result.data;
                    const delta =
                      chunk.type === "text-delta"
                        ? chunk.delta
                        : chunk.type === "text-start" && text
                          ? "\n\n"
                          : undefined;
                    // Keep progress from exhausting the chat's history budget.
                    if (delta && text.length < 12000) {
                      text = (text + delta).slice(0, 12000);
                      onProgress({ toolCallId: call.toolCallId, text });
                    }
                  }
                }
                return;
              }
            }
            const fields = [
              event.event ? `event: ${event.event}` : "",
              event.id ? `id: ${event.id}` : "",
              ...event.data.split("\n").map((line) => `data: ${line}`),
            ];
            controller.enqueue(
              new TextEncoder().encode(fields.filter(Boolean).join("\n") + "\n\n"),
            );
          },
        }),
      );
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
  return { calls, fetch: fetchWithProgress };
}
