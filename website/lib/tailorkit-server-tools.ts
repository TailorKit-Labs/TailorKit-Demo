import type { ToolContext, ToolImplementations } from "tailorkit";
import { contract } from "./tailorkit";
import { createCrmOperations } from "./crm-operations";

// TailorKit verifies the tool capability before invoking this implementation.
// Workspace identity comes only from its signed scope, never from tool input.
function workspaceTools(context: ToolContext) {
  if (context.scope.name !== "workspace") throw new Error("A workspace scope is required.");
  const { workspaceId } = contract.scopes.workspace.parse(context.scope.value);
  return createCrmOperations(workspaceId);
}

export function createTailorKitServerTools(onMutation: () => void) {
  return {
    workspace: {
      get: async ({ input, context }) => {
        const result = await workspaceTools(context).getWorkspace.execute(input);
        return result;
      },
    },
    contacts: {
      list: async ({ input, context }) => {
        const result = await workspaceTools(context).listContacts.execute(input);
        return result;
      },
      get: async ({ input, context }) => {
        const result = await workspaceTools(context).getContact.execute(input);
        return result;
      },
      create: async ({ input, context }) => {
        const result = await workspaceTools(context).createContact.execute(input);
        onMutation();
        return result;
      },
      update: async ({ input, context }) => {
        const result = await workspaceTools(context).updateContact.execute(input);
        onMutation();
        return result;
      },
      delete: async ({ input, context }) => {
        const result = await workspaceTools(context).deleteContact.execute(input);
        onMutation();
        return result;
      },
    },
    deals: {
      list: async ({ input, context }) => {
        const result = await workspaceTools(context).listDeals.execute(input);
        return result;
      },
      create: async ({ input, context }) => {
        const result = await workspaceTools(context).createDeal.execute(input);
        onMutation();
        return result;
      },
      update: async ({ input, context }) => {
        const result = await workspaceTools(context).updateDeal.execute(input);
        onMutation();
        return result;
      },
      delete: async ({ input, context }) => {
        const result = await workspaceTools(context).deleteDeal.execute(input);
        onMutation();
        return result;
      },
      move: async ({ input, context }) => {
        const result = await workspaceTools(context).moveDeal.execute(input);
        onMutation();
        return result;
      },
    },
    tasks: {
      list: async ({ input, context }) => {
        const result = await workspaceTools(context).listTasks.execute(input);
        return result;
      },
      create: async ({ input, context }) => {
        const result = await workspaceTools(context).createTask.execute(input);
        onMutation();
        return result;
      },
      update: async ({ input, context }) => {
        const result = await workspaceTools(context).updateTask.execute(input);
        onMutation();
        return result;
      },
      delete: async ({ input, context }) => {
        const result = await workspaceTools(context).deleteTask.execute(input);
        onMutation();
        return result;
      },
      setCompleted: async ({ input, context }) => {
        const result = await workspaceTools(context).setTaskCompleted.execute(input);
        onMutation();
        return result;
      },
    },
    activities: {
      list: async ({ input, context }) => {
        const result = await workspaceTools(context).listActivities.execute(input);
        return result;
      },
      addNote: async ({ input, context }) => {
        const result = await workspaceTools(context).addNote.execute(input);
        onMutation();
        return result;
      },
    },
  } satisfies ToolImplementations<typeof contract.tools, "server">;
}
