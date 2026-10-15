import { defineMeta, ORPCError, os } from "@orpc/server";
import type { RpcContext } from "./context";

export const [mutationMeta, getMutationMeta] = defineMeta(
  "mutation",
  (incoming: boolean) => incoming,
);

const base = os.$context<RpcContext>().use(async ({ context, next, procedure }) => {
  const result = await next();
  if (getMutationMeta(procedure)) context.onMutation?.();
  return result;
});

export const sessionProcedure = base.use(async ({ context, next }) => {
  if (!context.resolveUserId) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { userId: await context.resolveUserId() } });
});

export const protectedProcedure = base.use(async ({ context, next }) => {
  const tenant = context.tenant ?? (await context.resolveTenant());
  return next({ context: { tenant } });
});

export const mutationProcedure = protectedProcedure.meta(mutationMeta(true));
