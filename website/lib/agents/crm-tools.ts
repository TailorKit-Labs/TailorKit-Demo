import { tool } from "ai";
import { createCrmOperations } from "../crm-operations";

// Keep historical UI-message tool outputs readable. New operations validate
// outputs before returning, while old saved chats predate the expanded schemas.
function forAgent<T extends { outputSchema: unknown }>(operation: T) {
  const { outputSchema: _outputSchema, ...definition } = operation;
  return definition;
}

export function createCrmTools(tenantId: string) {
  const operations = createCrmOperations(tenantId);
  return {
    getWorkspace: tool(forAgent(operations.getWorkspace)),
    getContact: tool(forAgent(operations.getContact)),
    createContact: tool(forAgent(operations.createContact)),
    updateContact: tool(forAgent(operations.updateContact)),
    deleteContact: tool(forAgent(operations.deleteContact)),
    updateDeal: tool(forAgent(operations.updateDeal)),
    deleteDeal: tool(forAgent(operations.deleteDeal)),
    updateTask: tool(forAgent(operations.updateTask)),
    deleteTask: tool(forAgent(operations.deleteTask)),
    listActivities: tool(forAgent(operations.listActivities)),
    addNote: tool(forAgent(operations.addNote)),
    listDeals: tool(forAgent(operations.listDeals)),
    listContacts: tool(forAgent(operations.listContacts)),
    createDeal: tool(forAgent(operations.createDeal)),
    moveDeal: tool(forAgent(operations.moveDeal)),
    listTasks: tool(forAgent(operations.listTasks)),
    createTask: tool(forAgent(operations.createTask)),
    setTaskCompleted: tool(forAgent(operations.setTaskCompleted)),
  };
}
