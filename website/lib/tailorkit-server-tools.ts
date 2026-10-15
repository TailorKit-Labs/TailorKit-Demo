import type { ToolContext, ToolImplementations } from "tailorkit";
import { contract } from "./tailorkit";
import { call } from "@orpc/server";
import { router } from "../routers";
import { verifiedWorkspaceContext } from "../routers/context";

// TailorKit verifies the tool capability before invoking this implementation.
// Workspace identity comes only from its signed scope, never from tool input.
export function createTailorKitServerTools(onMutation: () => void) {
  function rpcContext(context: ToolContext) {
    if (context.scope.name !== "workspace") throw new Error("A workspace scope is required.");
    const { workspaceId } = contract.scopes.workspace.parse(context.scope.value);
    return verifiedWorkspaceContext(workspaceId, onMutation);
  }
  return {
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
  } satisfies ToolImplementations<typeof contract.tools, "server">;
}
