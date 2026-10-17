import type { UIMessage } from "ai";
import { z } from "zod";

const progressSchema = z.object({
  appId: z.string(),
  runId: z.string(),
  threadId: z.string(),
  text: z.string().max(12_000),
  tools: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        state: z.enum(["running", "completed", "error"]),
      }),
    )
    .max(20),
});

export type TailorKitProgress = z.infer<typeof progressSchema>;

const outputSchema = z.object({
  structuredContent: z.object({ agentProgress: progressSchema }),
});

// Tool outputs are remote input, including when restored from chat history.
export const readTailorKitProgress = (output: unknown): TailorKitProgress | undefined => {
  const parsed = outputSchema.safeParse(output);
  return parsed.success ? parsed.data.structuredContent.agentProgress : undefined;
};

export const summarizeTailorKitMessage = (
  identity: Pick<TailorKitProgress, "appId" | "runId" | "threadId">,
  message: UIMessage,
): TailorKitProgress => {
  const tools: TailorKitProgress["tools"] = [];
  const text: string[] = [];
  for (const part of message.parts) {
    if (part.type === "text") text.push(part.text);
    if (part.type !== "dynamic-tool" && !part.type.startsWith("tool-")) continue;
    if (!("toolCallId" in part) || !("state" in part)) continue;
    const name = part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);
    let state: TailorKitProgress["tools"][number]["state"] = "running";
    if (part.state === "output-available" && !part.preliminary) state = "completed";
    if (part.state === "output-error" || part.state === "output-denied") state = "error";
    tools.push({ id: part.toolCallId, name, state });
  }
  // Keep repeatedly transmitted previews bounded, and omit tool inputs/results
  // and private reasoning from the nested agent's presentation data.
  return { ...identity, text: text.join("\n\n").slice(-12_000), tools: tools.slice(-20) };
};
