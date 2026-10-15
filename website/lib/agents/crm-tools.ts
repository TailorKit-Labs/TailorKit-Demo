import { tool } from "ai";
import { createWorkspaceRpcClient } from "../rpc/server-client";
import { createCrmOperations } from "../crm-operations";

// Keep historical UI-message tool outputs readable. New operations validate
// outputs before returning, while old saved chats predate the expanded schemas.
function forAgent<T extends { outputSchema: unknown; execute: unknown }>(
  operation: T,
  execute: T["execute"],
) {
  const { outputSchema: _outputSchema, ...definition } = operation;
  return { ...definition, execute };
}

export function createCrmTools(tenantId: string) {
  const operations = createCrmOperations(tenantId);
  const rpc = createWorkspaceRpcClient(tenantId);
  return {
    getWorkspace: tool(forAgent(operations.getWorkspace, rpc.workspace.get)),
    getContact: tool(forAgent(operations.getContact, rpc.contacts.get)),
    createContact: tool(forAgent(operations.createContact, rpc.contacts.create)),
    updateContact: tool(forAgent(operations.updateContact, rpc.contacts.update)),
    deleteContact: tool(forAgent(operations.deleteContact, rpc.contacts.delete)),
    updateDeal: tool(forAgent(operations.updateDeal, rpc.deals.update)),
    deleteDeal: tool(forAgent(operations.deleteDeal, rpc.deals.delete)),
    updateTask: tool(forAgent(operations.updateTask, rpc.tasks.update)),
    deleteTask: tool(forAgent(operations.deleteTask, rpc.tasks.delete)),
    listActivities: tool(forAgent(operations.listActivities, rpc.activities.list)),
    addNote: tool(forAgent(operations.addNote, rpc.activities.addNote)),
    listDeals: tool(forAgent(operations.listDeals, rpc.deals.list)),
    listContacts: tool(forAgent(operations.listContacts, rpc.contacts.list)),
    createDeal: tool(forAgent(operations.createDeal, rpc.deals.create)),
    moveDeal: tool(forAgent(operations.moveDeal, rpc.deals.move)),
    listTasks: tool(forAgent(operations.listTasks, rpc.tasks.list)),
    createTask: tool(forAgent(operations.createTask, rpc.tasks.create)),
    setTaskCompleted: tool(forAgent(operations.setTaskCompleted, rpc.tasks.setCompleted)),
  };
}
