import { ORPCError } from "@orpc/server";
import { and, eq, gte } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db } from "../lib/drizzle";
import { tenants } from "../lib/schema";
import { CURRENT_SETUP_VERSION } from "../lib/provision";

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

export type RpcContext = {
  resolveTenant: () => Promise<RpcTenant>;
  resolveUserId?: () => Promise<string>;
  tenant?: RpcTenant;
  onMutation?: () => void;
};

export function requestContext(headers: Headers, onMutation?: () => void): RpcContext {
  let user: Promise<string> | undefined;
  const resolveUserId = () =>
    (user ??= auth.api.getSession({ headers }).then((session) => {
      if (!session)
        throw new ORPCError("UNAUTHORIZED", {
          message: "Your session expired. Refresh to create a demo workspace.",
        });
      return session.user.id;
    }));
  return {
    resolveUserId,
    resolveTenant: async () => tenantForUser(await resolveUserId()),
    onMutation,
  };
}

// Only use an ID resolved from a server session or a verified TailorKit scope.
// This capability does not grant access to session-only setup procedures.
export function verifiedWorkspaceContext(tenantId: string, onMutation?: () => void): RpcContext {
  return { resolveTenant: () => tenantFromVerifiedId(tenantId), onMutation };
}
