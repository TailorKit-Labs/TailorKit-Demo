import { CrmError } from "./crm-error";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./drizzle";
import { contacts } from "./schema";
import { contactFields } from "./crm-tool-schemas";
import { lockTenant, checkLimit, logActivity } from "./mutation-guards";

export const contactInput = contactFields;

// These internal operations accept the tenant resolved from the authenticated session by actions.ts.
export async function createContactRecord(tenantId: string, input: z.input<typeof contactInput>) {
  const data = contactInput.parse(input);
  return db.transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    await checkLimit(tx, contacts, tenantId);
    const id = crypto.randomUUID();
    await tx.insert(contacts).values({ ...data, id, tenantId });
    await logActivity(
      tx,
      tenantId,
      "contact",
      "Contact added",
      `${data.name} joined your workspace.`,
      id,
    );
    return id;
  });
}
export async function updateContactRecord(
  tenantId: string,
  id: string,
  input: z.input<typeof contactInput>,
) {
  const data = contactInput.parse(input);
  const rows = await db
    .update(contacts)
    .set(data)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
    .returning({ id: contacts.id });
  if (!rows.length) throw new CrmError("NOT_FOUND", "Contact not found.");
}
export async function deleteContactRecord(tenantId: string, id: string) {
  const rows = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
    .returning({ id: contacts.id });
  if (!rows.length) throw new CrmError("NOT_FOUND", "Contact not found.");
}
