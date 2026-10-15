import { and, count, desc, eq } from "drizzle-orm";
import { activities, contacts, deals, tasks, tenants } from "./schema";
import type { Transaction } from "./seed";

export const RECORD_LIMIT = 50;
export async function lockTenant(tx: Transaction, tenantId: string) {
  await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId)).for("update");
}
export async function checkLimit(
  tx: Transaction,
  table: typeof contacts | typeof deals | typeof tasks,
  tenantId: string,
) {
  const [row] = await tx.select({ total: count() }).from(table).where(eq(table.tenantId, tenantId));
  if (row.total >= RECORD_LIMIT)
    throw new Error("This demo allows 50 records per collection. Delete a record to add another.");
}
export async function checkContact(tx: Transaction, tenantId: string, contactId: string | null) {
  if (!contactId) return;
  const [row] = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
  if (!row) throw new Error("Contact not found in your workspace.");
}
export async function logActivity(
  tx: Transaction,
  tenantId: string,
  type: "contact" | "deal" | "task" | "note",
  title: string,
  description: string,
  contactId: string | null = null,
) {
  const id = crypto.randomUUID();
  await tx.insert(activities).values({ id, tenantId, type, title, description, contactId });
  const old = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(eq(activities.tenantId, tenantId))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .offset(50);
  for (const row of old) await tx.delete(activities).where(eq(activities.id, row.id));
  return id;
}
