import type { CallToolResult, Client } from "@modelcontextprotocol/client";
import { asSchema, readUIMessageStream, uiMessageChunkSchema, type UIMessageChunk } from "ai";
import { z } from "zod";
import { AGENT_TIMEOUT_MS } from "./agent-limits";
import { summarizeTailorKitMessage, type TailorKitProgress } from "./tailorkit-progress";

const eventSchema = z.object({
  appId: z.string().min(1),
  runId: z.string().min(1),
  threadId: z.string().min(1),
  status: z.enum(["started", "streaming"]).optional(),
  chunk: z.unknown().optional(),
});
const notificationSchema = z.object({
  _meta: z.object({ "dev.tailorkit/agent-stream": eventSchema.optional() }).optional(),
  message: z.string().optional(),
});
type ProgressEvent = z.infer<typeof eventSchema>;
const chunkSchema = asSchema(uiMessageChunkSchema);

const readLegacyEvent = (message: string | undefined): ProgressEvent | undefined => {
  if (!message?.trimStart().startsWith("{")) return;
  try {
    const parsed = eventSchema.safeParse(JSON.parse(message));
    return parsed.success ? parsed.data : undefined;
  } catch {
    // A progress message is human-readable text, even when it starts with a brace.
    return;
  }
};

/** Each invocation owns its progress stream, cancellation, and final result. */
export async function* streamTailorKitAgent(
  client: Client,
  input: Parameters<Client["callTool"]>[0],
  signal: AbortSignal,
): AsyncGenerator<CallToolResult> {
  const controller = new AbortController();
  const callSignal = AbortSignal.any([signal, controller.signal]);
  let identity: Pick<TailorKitProgress, "appId" | "runId" | "threadId"> | undefined;
  let progress: TailorKitProgress | undefined;
  let result: CallToolResult | undefined;
  let open = true;
  const source = new ReadableStream<ProgressEvent>({
    start(writer) {
      // Attach both completion handlers immediately, including before reading.
      // A disconnect must never leave an unhandled tool-call rejection.
      void client
        .callTool(input, {
          signal: callSignal,
          timeout: AGENT_TIMEOUT_MS,
          maxTotalTimeout: AGENT_TIMEOUT_MS,
          onprogress: (notification) => {
            if (!open || callSignal.aborted) return;
            try {
              const { _meta, message } = notificationSchema.parse(notification);
              const event = _meta?.["dev.tailorkit/agent-stream"];
              if (event) {
                writer.enqueue(event);
                return;
              }
              // Older platform deployments put JSON in message. Ordinary MCP
              // progress text remains display-only and must not fail the call.
              const legacyEvent = readLegacyEvent(message);
              if (legacyEvent) writer.enqueue(legacyEvent);
            } catch (error) {
              controller.abort(error);
            }
          },
        })
        .then(
          (output) => {
            result = output;
            if (open) writer.close();
          },
          (error: unknown) => {
            if (open) writer.error(error);
          },
        );
    },
    cancel() {
      open = false;
      controller.abort();
    },
  });
  const chunks = source.pipeThrough(
    new TransformStream<ProgressEvent, UIMessageChunk>({
      async transform(event, writer) {
        if (
          identity &&
          (identity.runId !== event.runId ||
            identity.appId !== event.appId ||
            identity.threadId !== event.threadId)
        ) {
          throw new Error("The app agent stream changed identity.");
        }
        identity = { appId: event.appId, runId: event.runId, threadId: event.threadId };
        if (event.chunk === undefined) {
          if (event.status !== "started") throw new Error("Missing app agent chunk.");
          writer.enqueue({ type: "start", messageId: event.runId });
          return;
        }
        const parsed = await chunkSchema.validate?.(event.chunk);
        if (!parsed?.success) throw new Error("Invalid app agent chunk.");
        writer.enqueue(parsed.value);
      },
    }),
    { signal: callSignal },
  );
  try {
    for await (const message of readUIMessageStream({ stream: chunks, terminateOnError: true })) {
      if (!identity) continue;
      progress = summarizeTailorKitMessage(identity, message);
      yield { content: [], structuredContent: { agentProgress: progress } };
    }
    callSignal.throwIfAborted();
    if (!result) throw new Error("The app agent stream ended without a result.");
    // Only the final MCP result reaches the model. Keep the bounded preview for
    // the UI and persisted history, including a final MCP tool error.
    yield progress
      ? {
          ...result,
          structuredContent: {
            ...z.record(z.string(), z.unknown()).parse(result.structuredContent ?? {}),
            agentProgress: progress,
          },
        }
      : result;
  } finally {
    open = false;
    controller.abort();
  }
}
