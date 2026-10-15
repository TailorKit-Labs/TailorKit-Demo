import { asc, desc, eq } from "drizzle-orm";
import { db } from "./drizzle";
import { activities, contacts, deals, tasks } from "./schema";
import type { Workspace } from "./workspace";
import type { RpcTenant } from "./rpc/auth";

export async function readWorkspace(tenant: RpcTenant): Promise<Workspace> {
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
}
