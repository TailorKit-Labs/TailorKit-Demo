import { cache } from "react";
import { headers } from "next/headers";
import { ORPCError } from "@orpc/server";
import { auth } from "./auth";
import { tenantForUser } from "./rpc/auth";

export const getCurrentSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
export const requireTenant = cache(async () => {
  const session = await getCurrentSession();
  if (!session)
    throw new ORPCError("UNAUTHORIZED", {
      message: "Your session expired. Refresh to create a demo workspace.",
    });
  return tenantForUser(session.user.id);
});
