import { createServer } from "tailorkit/server";
import type { ToolContext } from "tailorkit";
import { call } from "@orpc/server";
import { router } from "../routers";
import { verifiedWorkspaceContext } from "../routers/context";
import { contract } from "./tailorkit";

// TailorKit verifies the capability before calling a tool. Workspace identity
// comes from its signed scope, never from tool input.
function rpcContext(context: ToolContext) {
  if (context.scope.name !== "workspace") throw new Error("A workspace scope is required.");
  const { workspaceId } = contract.scopes.workspace.parse(context.scope.value);
  return verifiedWorkspaceContext(workspaceId);
}

const origin =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.BETTER_AUTH_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"));

export const tailorKit = createServer({
  contract,
  tools: {
    workspace: {
      get: async ({ input, context }) =>
        call(router.workspace.get, input, { context: rpcContext(context) }),
    },
    contacts: {
      list: async ({ input, context }) =>
        call(router.contacts.list, input, { context: rpcContext(context) }),
      get: async ({ input, context }) =>
        call(router.contacts.get, input, { context: rpcContext(context) }),
      create: async ({ input, context }) =>
        call(router.contacts.create, input, { context: rpcContext(context) }),
      update: async ({ input, context }) =>
        call(router.contacts.update, input, { context: rpcContext(context) }),
      delete: async ({ input, context }) =>
        call(router.contacts.delete, input, { context: rpcContext(context) }),
    },
    deals: {
      list: async ({ input, context }) =>
        call(router.deals.list, input, { context: rpcContext(context) }),
      create: async ({ input, context }) =>
        call(router.deals.create, input, { context: rpcContext(context) }),
      update: async ({ input, context }) =>
        call(router.deals.update, input, { context: rpcContext(context) }),
      delete: async ({ input, context }) =>
        call(router.deals.delete, input, { context: rpcContext(context) }),
      move: async ({ input, context }) =>
        call(router.deals.move, input, { context: rpcContext(context) }),
    },
    tasks: {
      list: async ({ input, context }) =>
        call(router.tasks.list, input, { context: rpcContext(context) }),
      create: async ({ input, context }) =>
        call(router.tasks.create, input, { context: rpcContext(context) }),
      update: async ({ input, context }) =>
        call(router.tasks.update, input, { context: rpcContext(context) }),
      delete: async ({ input, context }) =>
        call(router.tasks.delete, input, { context: rpcContext(context) }),
      setCompleted: async ({ input, context }) =>
        call(router.tasks.setCompleted, input, { context: rpcContext(context) }),
    },
    activities: {
      list: async ({ input, context }) =>
        call(router.activities.list, input, { context: rpcContext(context) }),
      addNote: async ({ input, context }) =>
        call(router.activities.addNote, input, { context: rpcContext(context) }),
    },
  },
  projectKey: process.env.TAILORKIT_PROJECT_KEY,
  baseUrl: new URL("/api/tailorkit", origin),
});
