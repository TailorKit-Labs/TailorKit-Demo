import { z } from "zod";

// Bound the public demo's context and reject client-supplied system instructions.
export const agentRequest = z.object({
  chatId: z.uuid(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        role: z.enum(["user", "assistant"]),
        parts: z
          .array(z.object({ type: z.string().max(100) }).passthrough())
          .min(1)
          .max(100),
      }),
    )
    .min(1)
    .max(20),
  page: z.enum(["/", "/contacts", "/pipeline", "/tasks", "/settings"]).default("/"),
  date: z.iso.date().optional(),
  timeZone: z
    .string()
    .max(100)
    .default("UTC")
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
});
