import { ORPCError } from "@orpc/server";
import { and, eq, gte } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../drizzle";
import { tenants } from "../schema";
import { CURRENT_SETUP_VERSION } from "../provision";

export type RpcTenant = Pick<typeof tenants.$inferSelect, "id" | "name" | "setupVersion">;

export async function tenantForUser(userId: string): Promise<RpcTenant> {
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, setupVersion: tenants.setupVersion })
    .from(tenants)
    .where(and(eq(tenants.userId, userId), gte(tenants.setupVersion, CURRENT_SETUP_VERSION)));
  if (!tenant) throw new ORPCError("FORBIDDEN", { message: "Workspace setup is not complete." });
  return tenant;
}

export async function tenantFromHeaders(headers: Headers): Promise<RpcTenant> {
  const session = await auth.api.getSession({ headers });
  if (!session)
    throw new ORPCError("UNAUTHORIZED", {
      message: "Your session expired. Refresh to create a demo workspace.",
    });
  return tenantForUser(session.user.id);
}

// Only trusted server callers use this with a session-derived tenant ID or a
// TailorKit-verified workspace scope. The HTTP handler always uses cookie auth.
export async function tenantFromVerifiedId(id: string): Promise<RpcTenant> {
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, setupVersion: tenants.setupVersion })
    .from(tenants)
    .where(and(eq(tenants.id, id), gte(tenants.setupVersion, CURRENT_SETUP_VERSION)));
  if (!tenant) throw new ORPCError("NOT_FOUND", { message: "Workspace not found." });
  return tenant;
}
