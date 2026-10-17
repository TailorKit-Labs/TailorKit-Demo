import { z } from "zod";
import { schemas, stage, status } from "../routers/schemas";
import type { Contact, Deal, Workspace } from "./workspace";

// View metadata uses TailorKit's restricted schema dialect. Keep fields and
// enums aligned with tool records, without unsupported formats or size limits.
const contact = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  company: z.string(),
  role: z.string(),
  status,
  createdAt: z.string(),
});
const deal = z.object({
  id: z.string(),
  title: z.string(),
  value: z.number(),
  stage,
  closeDate: z.string(),
  contactId: z.string().nullable(),
  createdAt: z.string(),
  position: z.number(),
});
const task = z.object({
  id: z.string(),
  title: z.string(),
  dueDate: z.string(),
  contactId: z.string().nullable(),
  completed: z.boolean(),
  createdAt: z.string(),
});
const activity = z.object({
  id: z.string(),
  contactId: z.string().nullable(),
  type: z.enum(["note", "contact", "deal", "task"]),
  title: z.string(),
  description: z.string(),
  createdAt: z.string(),
});
const currency = z.literal("USD");
const usage = schemas.workspace.get.output.shape.usage;

export const pageViews = {
  "/overview": z.object({
    contacts: z.array(contact),
    deals: z.array(deal),
    tasks: z.array(task),
    recentActivities: z.array(activity),
    summary: z.object({
      contacts: z.number(),
      customers: z.number(),
      activeAccounts: z.number(),
      openDeals: z.number(),
      pipelineValue: z.number(),
      revenue: z.number(),
      pendingTasks: z.number(),
    }),
    currency,
  }),
  "/contacts": z.object({
    contacts: z.array(contact),
    count: z.number(),
    filters: z
      .object({ query: z.string(), status: z.union([z.literal("all"), status]) })
      .optional(),
    sort: z
      .object({ field: z.enum(["name", "company", "email"]), direction: z.enum(["asc", "desc"]) })
      .optional(),
    pagination: z
      .object({ page: z.number(), pageSize: z.number(), totalPages: z.number(), total: z.number() })
      .optional(),
    visibleContactIds: z.array(z.string()).optional(),
    selectedContactIds: z.array(z.string()).optional(),
  }),
  "/contacts/detail": z.object({
    contact,
    deals: z.array(deal),
    tasks: z.array(task),
    activities: z.array(activity),
    activeTab: z.enum(["activity", "follow-ups", "opportunities"]),
    currency,
  }),
  "/pipeline": z.object({
    deals: z.array(deal),
    contacts: z.array(contact),
    filters: z.object({ query: z.string() }),
    stages: z.array(z.object({ stage, count: z.number(), totalValue: z.number() })),
    totalValue: z.number(),
    currency,
  }),
  "/tasks": z.object({
    tasks: z.array(task),
    contacts: z.array(contact),
    summary: z.object({ total: z.number(), pending: z.number(), completed: z.number() }),
  }),
  "/settings": z.object({ usage, currency }),
  "/app-pages": z.object({ appPage: z.object({ appId: z.string(), instanceKey: z.string() }) }),
};

export const pageViewPaths = [
  "/",
  "/overview",
  "/contacts",
  "/contacts/detail",
  "/pipeline",
  "/tasks",
  "/settings",
  "/app-pages",
] as const;

// Parse through the public record schemas to omit tenant IDs and normalize the
// snapshot's ISO timestamps into the calendar dates used by app tools.
function contactRecords(workspace: Workspace) {
  return workspace.contacts.map((row) => contact.parse(row));
}
function dealRecords(rows: Deal[]) {
  return rows.map((row) => deal.parse({ ...row, closeDate: row.closeDate.slice(0, 10) }));
}
function taskRecords(workspace: Workspace) {
  return workspace.tasks.map((row) => task.parse({ ...row, dueDate: row.dueDate.slice(0, 10) }));
}

export function overviewViewContext(workspace: Workspace) {
  const data = {
    contacts: contactRecords(workspace),
    deals: dealRecords(workspace.deals),
    tasks: taskRecords(workspace),
  };
  const openDeals = data.deals.filter((row) => row.stage !== "won" && row.stage !== "lost");
  return {
    ...data,
    recentActivities: workspace.activities.map((row) => activity.parse(row)),
    summary: {
      contacts: data.contacts.length,
      customers: data.contacts.filter((row) => row.status === "customer").length,
      activeAccounts: data.contacts.filter((row) => row.status !== "lead").length,
      openDeals: openDeals.length,
      pipelineValue: openDeals.reduce((sum, row) => sum + row.value, 0),
      revenue: data.deals
        .filter((row) => row.stage === "won")
        .reduce((sum, row) => sum + row.value, 0),
      pendingTasks: data.tasks.filter((row) => !row.completed).length,
    },
    currency: "USD" as const,
  };
}

export function contactsViewContext(workspace: Workspace) {
  return { contacts: contactRecords(workspace), count: workspace.contacts.length };
}

export function contactViewContext(
  workspace: Workspace,
  selected: Contact,
  activeTab: "activity" | "follow-ups" | "opportunities",
) {
  return {
    contact: contact.parse(selected),
    deals: dealRecords(workspace.deals.filter((row) => row.contactId === selected.id)),
    tasks: taskRecords(workspace).filter((row) => row.contactId === selected.id),
    activities: workspace.activities
      .filter((row) => row.contactId === selected.id)
      .map((row) => activity.parse(row)),
    activeTab,
    currency: "USD" as const,
  };
}

export function pipelineViewContext(workspace: Workspace, visibleDeals: Deal[], query: string) {
  const deals = dealRecords(visibleDeals);
  return {
    deals,
    contacts: contactRecords(workspace),
    filters: { query },
    stages: stage.options.map((value) => {
      const rows = deals.filter((row) => row.stage === value);
      return {
        stage: value,
        count: rows.length,
        totalValue: rows.reduce((sum, row) => sum + row.value, 0),
      };
    }),
    totalValue: deals.reduce((sum, row) => sum + row.value, 0),
    currency: "USD" as const,
  };
}

export function tasksViewContext(workspace: Workspace) {
  const tasks = taskRecords(workspace);
  const completed = tasks.filter((row) => row.completed).length;
  return {
    tasks,
    contacts: contactRecords(workspace),
    summary: { total: tasks.length, pending: tasks.length - completed, completed },
  };
}

export function settingsViewContext(workspace: Workspace) {
  return {
    usage: {
      contacts: workspace.contacts.length,
      deals: workspace.deals.length,
      tasks: workspace.tasks.length,
      limit: 50,
    },
    currency: "USD" as const,
  };
}
