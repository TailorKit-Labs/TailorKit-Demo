import { defineContract } from "tailorkit";
import { primitives } from "tailorkit/zod";
import { z } from "zod";

export const contract = defineContract({
  scopes: { workspace: z.object({ workspaceId: z.string().min(1) }) },
  components: {
    ...primitives({
      tokens: {
        borderColor: { default: "var(--border)", input: "var(--input)" },
        textColor: { default: "var(--foreground)", muted: "var(--muted-foreground)" },
      },
    }),
  },
  views: {
    "/": z.object({
      workspace: z.object({ id: z.string(), name: z.string() }),
      page: z.string(),
    }),
  },
  slots: { panel: { views: ["/"] } },
});
