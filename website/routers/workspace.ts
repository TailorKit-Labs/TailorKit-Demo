import { aiSdkTool } from "@orpc/ai-sdk";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../lib/drizzle";
import { contacts, deals, tasks, activities } from "../lib/schema";
import { protectedProcedure, sessionProcedure } from "./base";
import { schemas } from "./schemas";
import { RECORD_LIMIT } from "./shared";
import { provisionForUser } from "../lib/provision";
import type { Workspace } from "../lib/workspace";

export const provisionWorkspace = sessionProcedure.handler(async ({ context }) => {
  await provisionForUser(context.userId);
  return { success: true as const };
});

export const snapshotWorkspace = protectedProcedure.handler(
  async ({ context }): Promise<Workspace> => {
    const tenant = context.tenant;
    const [contactRows, dealRows, taskRows, activityRows] = await Promise.all([
      db
        .select()
        .from(contacts)
        .where(eq(contacts.tenantId, tenant.id))
        .orderBy(desc(contacts.createdAt)),
      db
        .select()
        .from(deals)
        .where(eq(deals.tenantId, tenant.id))
        .orderBy(asc(deals.position), desc(deals.createdAt), asc(deals.id)),
      db.select().from(tasks).where(eq(tasks.tenantId, tenant.id)).orderBy(tasks.dueDate),
      db
        .select()
        .from(activities)
        .where(eq(activities.tenantId, tenant.id))
        .orderBy(desc(activities.createdAt))
        .limit(50),
    ]);
    return {
      tenant: { id: tenant.id, name: tenant.name, setupVersion: tenant.setupVersion },
      contacts: contactRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      deals: dealRows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        closeDate: r.closeDate.toISOString(),
      })),
      tasks: taskRows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        dueDate: r.dueDate.toISOString(),
      })),
      activities: activityRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  },
);

export const getWorkspace = protectedProcedure
  .meta(
    aiSdkTool({
      description:
        "View workspace usage, collection limits and total pipeline value for the dashboard and settings.",
    }),
  )
  .input(schemas.workspace.get.input)
  .output(schemas.workspace.get.output)
  .handler(async ({ context }) => {
    const tenantId = context.tenant.id;

    const workspace = { name: context.tenant.name };
    const [contactRows, dealRows, taskRows] = await Promise.all([
      db.select({ id: contacts.id }).from(contacts).where(eq(contacts.tenantId, tenantId)),
      db.select({ value: deals.value }).from(deals).where(eq(deals.tenantId, tenantId)),
      db.select({ id: tasks.id }).from(tasks).where(eq(tasks.tenantId, tenantId)),
    ]);
    return {
      workspace,
      usage: {
        contacts: contactRows.length,
        deals: dealRows.length,
        tasks: taskRows.length,
        limit: RECORD_LIMIT,
      },
      pipelineValue: dealRows.reduce((sum, row) => sum + row.value, 0),
      currency: "USD" as const,
    };
  });
