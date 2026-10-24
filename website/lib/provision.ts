import { eq, sql } from "drizzle-orm";
import { db } from "./drizzle";
import { tenants } from "./schema";
import { seedWorkspace } from "./seed";
import { installMessages } from "./install-messages";
import { installDoom as installDoomApp } from "./install-doom";
import { installStripe as installStripeApp } from "./install-stripe";

export const CURRENT_SETUP_VERSION = 4;
export async function provisionForUser(
  userId: string,
  {
    complete = true,
    install = installMessages,
    installDoom = installDoomApp,
    installStripe = installStripeApp,
  }: {
    complete?: boolean;
    install?: (workspaceId: string) => Promise<unknown>;
    installDoom?: (workspaceId: string) => Promise<unknown>;
    installStripe?: (workspaceId: string) => Promise<unknown>;
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
  async function installStep(
    version: number,
    installer: (workspaceId: string) => Promise<unknown>,
  ) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      let [tenant] = await tx.select().from(tenants).where(eq(tenants.userId, userId));
      if (!tenant) throw new Error("Workspace not found. Please retry setup.");
      if (tenant.setupVersion < version) {
        await installer(tenant.id);
        [tenant] = await tx
          .update(tenants)
          .set({ setupVersion: version })
          .where(eq(tenants.id, tenant.id))
          .returning();
      }
      return tenant;
    });
  }
  // Commit each completed app independently so retries preserve earlier installations.
  await installStep(2, install);
  await installStep(3, installDoom);
  return installStep(4, installStripe);
}
