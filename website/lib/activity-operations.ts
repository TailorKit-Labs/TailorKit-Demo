import { z } from "zod";
import { db } from "./drizzle";
import { checkContact, lockTenant, logActivity } from "./mutation-guards";

export async function addNoteRecord(tenantId: string, contactId: string, body: string) {
  const description = z.string().trim().min(1).max(1000).parse(body);
  return db.transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    await checkContact(tx, tenantId, contactId);
    return logActivity(tx, tenantId, "note", "Note added", description, contactId);
  });
}
