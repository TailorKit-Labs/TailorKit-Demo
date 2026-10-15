import { os, ORPCError } from "@orpc/server";
import { z } from "zod";
import { createCrmOperations } from "../crm-operations";
import { crmToolSchemas, type CrmToolName, mutationToolNames } from "../crm-tool-schemas";
import { readWorkspace } from "../workspace-queries";
import { CrmError } from "../crm-error";
import type { RpcTenant } from "./auth";

export type RpcContext = {
  resolveTenant: () => Promise<RpcTenant>;
  onMutation?: () => void;
};
const mutationTools = new Set<string>(mutationToolNames);
const authenticated = os.$context<RpcContext>().use(async ({ context, next }) => {
  const tenant = await context.resolveTenant();
  try {
    return await next({ context: { tenant, crm: createCrmOperations(tenant.id) } });
  } catch (error) {
    if (error instanceof CrmError)
      throw new ORPCError(error.code, { message: error.message, cause: error });
    throw error;
  }
});

// Every transport uses the same input/output validation, auth and mutations.
function procedure<I, O>(
  name: CrmToolName,
  schema: { input: z.ZodType<I>; output: z.ZodType<O> },
  execute: (crm: ReturnType<typeof createCrmOperations>, input: I) => Promise<O>,
) {
  return authenticated
    .input(schema.input)
    .output(schema.output)
    .handler(async ({ input, context }) => {
      const result = await execute(context.crm, input);
      if (mutationTools.has(name)) context.onMutation?.();
      return result;
    });
}

export const router = {
  workspace: {
    snapshot: authenticated.handler(({ context }) => readWorkspace(context.tenant)),
    get: procedure("getWorkspace", crmToolSchemas.getWorkspace, (crm, input) =>
      crm.getWorkspace.execute(input),
    ),
  },
  contacts: {
    list: procedure("listContacts", crmToolSchemas.listContacts, (crm, input) =>
      crm.listContacts.execute(input),
    ),
    get: procedure("getContact", crmToolSchemas.getContact, (crm, input) =>
      crm.getContact.execute(input),
    ),
    create: procedure("createContact", crmToolSchemas.createContact, (crm, input) =>
      crm.createContact.execute(input),
    ),
    update: procedure("updateContact", crmToolSchemas.updateContact, (crm, input) =>
      crm.updateContact.execute(input),
    ),
    delete: procedure("deleteContact", crmToolSchemas.deleteContact, (crm, input) =>
      crm.deleteContact.execute(input),
    ),
  },
  deals: {
    list: procedure("listDeals", crmToolSchemas.listDeals, (crm, input) =>
      crm.listDeals.execute(input),
    ),
    create: procedure("createDeal", crmToolSchemas.createDeal, (crm, input) =>
      crm.createDeal.execute(input),
    ),
    update: procedure("updateDeal", crmToolSchemas.updateDeal, (crm, input) =>
      crm.updateDeal.execute(input),
    ),
    delete: procedure("deleteDeal", crmToolSchemas.deleteDeal, (crm, input) =>
      crm.deleteDeal.execute(input),
    ),
    move: procedure("moveDeal", crmToolSchemas.moveDeal, (crm, input) =>
      crm.moveDeal.execute(input),
    ),
  },
  tasks: {
    list: procedure("listTasks", crmToolSchemas.listTasks, (crm, input) =>
      crm.listTasks.execute(input),
    ),
    create: procedure("createTask", crmToolSchemas.createTask, (crm, input) =>
      crm.createTask.execute(input),
    ),
    update: procedure("updateTask", crmToolSchemas.updateTask, (crm, input) =>
      crm.updateTask.execute(input),
    ),
    delete: procedure("deleteTask", crmToolSchemas.deleteTask, (crm, input) =>
      crm.deleteTask.execute(input),
    ),
    setCompleted: procedure("setTaskCompleted", crmToolSchemas.setTaskCompleted, (crm, input) =>
      crm.setTaskCompleted.execute(input),
    ),
  },
  activities: {
    list: procedure("listActivities", crmToolSchemas.listActivities, (crm, input) =>
      crm.listActivities.execute(input),
    ),
    addNote: procedure("addNote", crmToolSchemas.addNote, (crm, input) =>
      crm.addNote.execute(input),
    ),
  },
};
