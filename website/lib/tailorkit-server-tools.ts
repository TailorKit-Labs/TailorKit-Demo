import type { ToolContext, ToolImplementations } from "tailorkit";
import { contract } from "./tailorkit";
import { createWorkspaceRpcClient } from "./rpc/server-client";

// TailorKit verifies the tool capability before invoking this implementation.
// Workspace identity comes only from its signed scope, never from tool input.
export function createTailorKitServerTools(onMutation: () => void) {
  function client(context: ToolContext) {
    if (context.scope.name !== "workspace") throw new Error("A workspace scope is required.");
    const { workspaceId } = contract.scopes.workspace.parse(context.scope.value);
    return createWorkspaceRpcClient(workspaceId, onMutation);
  }
  return {
    workspace: {
      get: async ({ input, context }) => client(context).workspace.get(input),
    },
    contacts: {
      list: async ({ input, context }) => client(context).contacts.list(input),
      get: async ({ input, context }) => client(context).contacts.get(input),
      create: async ({ input, context }) => client(context).contacts.create(input),
      update: async ({ input, context }) => client(context).contacts.update(input),
      delete: async ({ input, context }) => client(context).contacts.delete(input),
    },
    deals: {
      list: async ({ input, context }) => client(context).deals.list(input),
      create: async ({ input, context }) => client(context).deals.create(input),
      update: async ({ input, context }) => client(context).deals.update(input),
      delete: async ({ input, context }) => client(context).deals.delete(input),
      move: async ({ input, context }) => client(context).deals.move(input),
    },
    tasks: {
      list: async ({ input, context }) => client(context).tasks.list(input),
      create: async ({ input, context }) => client(context).tasks.create(input),
      update: async ({ input, context }) => client(context).tasks.update(input),
      delete: async ({ input, context }) => client(context).tasks.delete(input),
      setCompleted: async ({ input, context }) => client(context).tasks.setCompleted(input),
    },
    activities: {
      list: async ({ input, context }) => client(context).activities.list(input),
      addNote: async ({ input, context }) => client(context).activities.addNote(input),
    },
  } satisfies ToolImplementations<typeof contract.tools, "server">;
}
