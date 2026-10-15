import { ORPCError, os } from "@orpc/server";
import type { RpcContext } from "./context";

const base = os.$context<RpcContext>();

export const sessionProcedure = base.use(async ({ context, next }) => {
  if (!context.resolveUserId) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { userId: await context.resolveUserId() } });
});

export const protectedProcedure = base.use(async ({ context, next }) => {
  const tenant = context.tenant ?? (await context.resolveTenant());
  return next({ context: { tenant } });
});
