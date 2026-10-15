import { defineContract } from "tailorkit";
import { primitives } from "tailorkit/zod";
import { z } from "zod";

const contact = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  company: z.string(),
  role: z.string(),
  status: z.enum(["lead", "active", "customer"]),
  createdAt: z.string(),
});
const deal = z.object({
  id: z.string(),
  title: z.string(),
  contactId: z.string().nullable(),
  value: z.number(),
  stage: z.enum(["qualified", "proposal", "negotiation", "won", "lost"]),
  closeDate: z.string(),
  position: z.number(),
  createdAt: z.string(),
});
const task = z.object({
  id: z.string(),
  title: z.string(),
  contactId: z.string().nullable(),
  dueDate: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),
});
const activity = z.object({
  id: z.string(),
  contactId: z.string().nullable(),
  type: z.enum(["note", "deal", "task", "contact"]),
  title: z.string(),
  description: z.string(),
  createdAt: z.string(),
});

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
    "/overview": z.object({
      contacts: z.array(contact),
      deals: z.array(deal),
      tasks: z.array(task),
      activities: z.array(activity),
    }),
    "/contacts": z.object({ contacts: z.array(contact) }),
    "/contacts/detail": z.object({
      contact,
      deals: z.array(deal),
      tasks: z.array(task),
      activities: z.array(activity),
    }),
    "/pipeline": z.object({ deals: z.array(deal), contacts: z.array(contact) }),
    "/tasks": z.object({ tasks: z.array(task), contacts: z.array(contact) }),
    "/settings": z.object({
      usage: z.object({ contacts: z.number(), deals: z.number(), tasks: z.number() }),
    }),
  },
  slots: {
    panel: {
      views: [
        "/",
        "/overview",
        "/contacts",
        "/contacts/detail",
        "/pipeline",
        "/tasks",
        "/settings",
      ],
    },
  },
});
