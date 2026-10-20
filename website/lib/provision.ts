import { eq, sql } from "drizzle-orm";
import { db } from "./drizzle";
import { tenants } from "./schema";
import { seedWorkspace } from "./seed";
import { installMessages } from "./install-messages";

export const CURRENT_SETUP_VERSION = 2;
export async function provisionForUser(
  userId: string,
  {
    complete = true,
    install = installMessages,
  }: {
    complete?: boolean;
    install?: (workspaceId: string) => Promise<unknown>;
  } = {},
) {
  const prepared = await db.transaction(async (tx) => {
    // A per-account transaction lock makes retries and concurrent browser tabs idempotent.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    let [tenant] = await tx.select().from(tenants).where(eq(tenants.userId, userId));
    if (!tenant)
      [tenant] = await tx
        .insert(tenants)
        .values({ id: crypto.randomUUID(), userId, name: "Acme Studio" })
        .returning();
    if (tenant.setupVersion < 1) {
      await seedWorkspace(tx, tenant.id);
      [tenant] = await tx
        .update(tenants)
        .set({ setupVersion: 1 })
        .where(eq(tenants.id, tenant.id))
        .returning();
    }
    return tenant;
  });
  if (!complete || prepared.setupVersion >= CURRENT_SETUP_VERSION) return prepared;

  // Commit the workspace before remote installation so retries always reuse
  // the same scope, even when a platform request fails midway through setup.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    let [tenant] = await tx.select().from(tenants).where(eq(tenants.userId, userId));
    if (!tenant) throw new Error("Workspace not found. Please retry setup.");
    if (tenant.setupVersion < CURRENT_SETUP_VERSION) {
      await install(tenant.id);
      [tenant] = await tx
        .update(tenants)
        .set({ setupVersion: CURRENT_SETUP_VERSION })
        .where(eq(tenants.id, tenant.id))
        .returning();
    }
    return tenant;
  });
}
