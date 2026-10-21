import { createServer } from "patchsmith/server";
import type { ToolContext } from "patchsmith";
import { call } from "@orpc/server";
import * as workspace from "../routers/workspace";
import * as contacts from "../routers/contacts";
import * as deals from "../routers/deals";
import * as tasks from "../routers/tasks";
import * as activities from "../routers/activities";
import { verifiedWorkspaceContext } from "../routers/context";
import { contract } from "./patchsmith";
import { patchsmithOrigin, patchsmithRequestOrigin } from "./patchsmith-origin";

// Patchsmith verifies the capability before calling a tool. Workspace identity
// comes from its signed scope, never from tool input.
function rpcContext(context: ToolContext) {
  if (context.scope.name !== "workspace") throw new Error("A workspace scope is required.");
  const { workspaceId } = contract.scopes.workspace.parse(context.scope.value);
  return verifiedWorkspaceContext(workspaceId);
}

function createHost(origin: string) {
  return createServer({
    contract,
    tools: {
      workspace: {
        get: async ({ input, context }) =>
          call(workspace.getWorkspace, input, { context: rpcContext(context) }),
      },
      contacts: {
        list: async ({ input, context }) =>
          call(contacts.listContacts, input, { context: rpcContext(context) }),
        get: async ({ input, context }) =>
          call(contacts.getContact, input, { context: rpcContext(context) }),
        create: async ({ input, context }) =>
          call(contacts.createContact, input, { context: rpcContext(context) }),
        update: async ({ input, context }) =>
          call(contacts.updateContact, input, { context: rpcContext(context) }),
        delete: async ({ input, context }) =>
          call(contacts.deleteContact, input, { context: rpcContext(context) }),
      },
      deals: {
        list: async ({ input, context }) =>
          call(deals.listDeals, input, { context: rpcContext(context) }),
        create: async ({ input, context }) =>
          call(deals.createDeal, input, { context: rpcContext(context) }),
        update: async ({ input, context }) =>
          call(deals.updateDeal, input, { context: rpcContext(context) }),
        delete: async ({ input, context }) =>
          call(deals.deleteDeal, input, { context: rpcContext(context) }),
        move: async ({ input, context }) =>
          call(deals.moveDeal, input, { context: rpcContext(context) }),
      },
      tasks: {
        list: async ({ input, context }) =>
          call(tasks.listTasks, input, { context: rpcContext(context) }),
        create: async ({ input, context }) =>
          call(tasks.createTask, input, { context: rpcContext(context) }),
        update: async ({ input, context }) =>
          call(tasks.updateTask, input, { context: rpcContext(context) }),
        delete: async ({ input, context }) =>
          call(tasks.deleteTask, input, { context: rpcContext(context) }),
        setCompleted: async ({ input, context }) =>
          call(tasks.setTaskCompleted, input, { context: rpcContext(context) }),
      },
      activities: {
        list: async ({ input, context }) =>
          call(activities.listActivities, input, { context: rpcContext(context) }),
        addNote: async ({ input, context }) =>
          call(activities.addNote, input, { context: rpcContext(context) }),
      },
    },
    projectKey: process.env.PATCHSMITH_PROJECT_KEY,
    baseUrl: new URL("/api/patchsmith", origin),
  });
}

export const patchsmith = createHost(patchsmithOrigin());
const hosts = new Map([[patchsmithOrigin(), patchsmith]]);

export function patchsmithForRequest(request: Request) {
  const origin = patchsmithRequestOrigin(request.url);
  let host = hosts.get(origin);
  if (!host) {
    host = createHost(origin);
    hosts.set(origin, host);
  }
  return host;
}
