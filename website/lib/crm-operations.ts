import { z } from "zod";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "./drizzle";
import { crmToolSchemas } from "./crm-tool-schemas";
import {
  createContactRecord,
  updateContactRecord,
  deleteContactRecord,
} from "./contact-operations";
import { addNoteRecord } from "./activity-operations";
import { RECORD_LIMIT } from "./mutation-guards";
import { activities, contacts, deals, tasks, tenants } from "./schema";
import {
  createDealRecord,
  updateDealRecord,
  deleteDealRecord,
  moveDealRecord,
} from "./deal-operations";
import {
  createTaskRecord,
  updateTaskRecord,
  deleteTaskRecord,
  setTaskCompletedRecord,
} from "./task-operations";

function operation<I extends z.ZodType, O extends z.ZodType>(definition: {
  description: string;
  inputSchema: I;
  outputSchema: O;
  execute: (input: z.output<I>) => Promise<z.input<O>>;
}) {
  return {
    ...definition,
    execute: async (input: z.input<I>) =>
      definition.outputSchema.parse(await definition.execute(definition.inputSchema.parse(input))),
  };
}

function substringPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}

// Callers supply the workspace resolved from a session or verified TailorKit scope.
// It is deliberately absent from every tool input schema.
export function createCrmOperations(tenantId: string) {
  return {
    getWorkspace: operation({
      description:
        "View workspace usage, collection limits and total pipeline value for the dashboard and settings.",
      inputSchema: crmToolSchemas.getWorkspace.input,
      outputSchema: crmToolSchemas.getWorkspace.output,
      execute: async () => {
        const [workspace] = await db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, tenantId));
        if (!workspace) throw new Error("Workspace not found.");
        const [contactRows, dealRows, taskRows] = await Promise.all([
          db.select({ id: contacts.id }).from(contacts).where(eq(contacts.tenantId, tenantId)),
          db.select({ value: deals.value }).from(deals).where(eq(deals.tenantId, tenantId)),
          db.select({ id: tasks.id }).from(tasks).where(eq(tasks.tenantId, tenantId)),
        ]);
        return {
          workspace,
          usage: {
            contacts: contactRows.length,
            deals: dealRows.length,
            tasks: taskRows.length,
            limit: RECORD_LIMIT,
          },
          pipelineValue: dealRows.reduce((sum, row) => sum + row.value, 0),
          currency: "USD" as const,
        };
      },
    }),
    getContact: operation({
      description:
        "Open a contact's details, related deals, follow-ups, notes and activity history.",
      inputSchema: crmToolSchemas.getContact.input,
      outputSchema: crmToolSchemas.getContact.output,
      execute: async ({ id }) => {
        const [contact] = await db
          .select({
            id: contacts.id,
            name: contacts.name,
            email: contacts.email,
            company: contacts.company,
            role: contacts.role,
            status: contacts.status,
            createdAt: contacts.createdAt,
          })
          .from(contacts)
          .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
        if (!contact) throw new Error("Contact not found.");
        const [dealRows, taskRows, activityRows] = await Promise.all([
          db
            .select()
            .from(deals)
            .where(and(eq(deals.tenantId, tenantId), eq(deals.contactId, id)))
            .orderBy(asc(deals.position), desc(deals.createdAt), asc(deals.id)),
          db
            .select()
            .from(tasks)
            .where(and(eq(tasks.tenantId, tenantId), eq(tasks.contactId, id)))
            .orderBy(asc(tasks.dueDate)),
          db
            .select()
            .from(activities)
            .where(and(eq(activities.tenantId, tenantId), eq(activities.contactId, id)))
            .orderBy(desc(activities.createdAt))
            .limit(50),
        ]);
        return {
          contact: { ...contact, createdAt: contact.createdAt.toISOString() },
          deals: dealRows.map(
            ({ id, title, value, stage, closeDate, contactId, position, createdAt }) => ({
              id,
              title,
              value,
              stage,
              contactId,
              closeDate: closeDate.toISOString().slice(0, 10),
              position,
              createdAt: createdAt.toISOString(),
            }),
          ),
          tasks: taskRows.map(({ id, title, dueDate, completed, contactId, createdAt }) => ({
            id,
            title,
            completed,
            contactId,
            dueDate: dueDate.toISOString().slice(0, 10),
            createdAt: createdAt.toISOString(),
          })),
          activities: activityRows.map(({ tenantId: _tenantId, ...row }) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
          })),
          href: `/contacts/${id}`,
        };
      },
    }),
    createContact: operation({
      description: "Create a contact with name, email, company, role and relationship status.",
      inputSchema: crmToolSchemas.createContact.input,
      outputSchema: crmToolSchemas.createContact.output,
      execute: async (input) => {
        const record = crmToolSchemas.createContact.input.parse(input);
        const id = await createContactRecord(tenantId, record);
        return { success: true as const, contact: { ...record, id }, href: `/contacts/${id}` };
      },
    }),
    updateContact: operation({
      description:
        "Edit a contact. Supply all fields from getContact, changing only the requested fields.",
      inputSchema: crmToolSchemas.updateContact.input,
      outputSchema: crmToolSchemas.updateContact.output,
      execute: async ({ id, ...input }) => {
        await updateContactRecord(tenantId, id, input);
        return { success: true as const, id, href: `/contacts/${id}` };
      },
    }),
    deleteContact: operation({
      description:
        "Delete a contact when explicitly requested. Its notes/activity are deleted; related deals and tasks are retained without a linked contact.",
      inputSchema: crmToolSchemas.deleteContact.input,
      outputSchema: crmToolSchemas.deleteContact.output,
      execute: async ({ id }) => {
        await deleteContactRecord(tenantId, id);
        return { success: true as const, id, href: "/contacts" };
      },
    }),
    updateDeal: operation({
      description:
        "Edit all deal details: title, whole USD value, stage, close date and linked contact. Preserve unspecified fields using listDeals.",
      inputSchema: crmToolSchemas.updateDeal.input,
      outputSchema: crmToolSchemas.updateDeal.output,
      execute: async ({ id, ...input }) => {
        await updateDealRecord(tenantId, id, input);
        return { success: true as const, id, href: "/pipeline" };
      },
    }),
    deleteDeal: operation({
      description: "Delete an existing deal when explicitly requested. Look up the ID first.",
      inputSchema: crmToolSchemas.deleteDeal.input,
      outputSchema: crmToolSchemas.deleteDeal.output,
      execute: async ({ id }) => {
        await deleteDealRecord(tenantId, id);
        return { success: true as const, id, href: "/pipeline" };
      },
    }),
    updateTask: operation({
      description:
        "Edit a follow-up's title, due date and linked contact, preserving its completion status.",
      inputSchema: crmToolSchemas.updateTask.input,
      outputSchema: crmToolSchemas.updateTask.output,
      execute: async ({ id, ...input }) => {
        await updateTaskRecord(tenantId, id, input);
        return { success: true as const, id, href: "/tasks" };
      },
    }),
    deleteTask: operation({
      description: "Delete a follow-up when explicitly requested. Look up the ID first.",
      inputSchema: crmToolSchemas.deleteTask.input,
      outputSchema: crmToolSchemas.deleteTask.output,
      execute: async ({ id }) => {
        await deleteTaskRecord(tenantId, id);
        return { success: true as const, id, href: "/tasks" };
      },
    }),
    listActivities: operation({
      description: "Read the latest workspace activity and notes, optionally for one contact.",
      inputSchema: crmToolSchemas.listActivities.input,
      outputSchema: crmToolSchemas.listActivities.output,
      execute: async ({ contactId }) => {
        const rows = await db
          .select({
            id: activities.id,
            contactId: activities.contactId,
            type: activities.type,
            title: activities.title,
            description: activities.description,
            createdAt: activities.createdAt,
          })
          .from(activities)
          .where(
            and(
              eq(activities.tenantId, tenantId),
              contactId ? eq(activities.contactId, contactId) : undefined,
            ),
          )
          .orderBy(desc(activities.createdAt), desc(activities.id))
          .limit(50);
        return {
          activities: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
          count: rows.length,
        };
      },
    }),
    addNote: operation({
      description:
        "Add a note to an existing contact. Notes appear in the contact's activity history.",
      inputSchema: crmToolSchemas.addNote.input,
      outputSchema: crmToolSchemas.addNote.output,
      execute: async ({ contactId, body }) => {
        const id = await addNoteRecord(tenantId, contactId, body);
        return { success: true as const, id, href: `/contacts/${contactId}` };
      },
    }),
    listDeals: operation({
      description:
        "View or search the current workspace's deals, optionally by stage. Returns live records and total value in USD.",
      inputSchema: crmToolSchemas.listDeals.input,
      outputSchema: crmToolSchemas.listDeals.output,
      execute: async ({ query, stage, contactId }) => {
        const pattern = query ? substringPattern(query) : undefined;
        const rows = await db
          .select({
            id: deals.id,
            title: deals.title,
            value: deals.value,
            stage: deals.stage,
            position: deals.position,
            createdAt: deals.createdAt,
            closeDate: deals.closeDate,
            contactId: deals.contactId,
            contact: contacts.name,
            company: contacts.company,
          })
          .from(deals)
          .leftJoin(
            contacts,
            and(eq(contacts.id, deals.contactId), eq(contacts.tenantId, tenantId)),
          )
          .where(
            and(
              eq(deals.tenantId, tenantId),
              stage ? eq(deals.stage, stage) : undefined,
              contactId ? eq(deals.contactId, contactId) : undefined,
              pattern
                ? or(
                    ilike(deals.title, pattern),
                    ilike(contacts.name, pattern),
                    ilike(contacts.company, pattern),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(deals.position), desc(deals.createdAt), asc(deals.id))
          .limit(50);
        return {
          deals: rows.map((row) => ({
            ...row,
            closeDate: row.closeDate.toISOString().slice(0, 10),
            createdAt: row.createdAt.toISOString(),
          })),
          count: rows.length,
          totalValue: rows.reduce((total, row) => total + row.value, 0),
          currency: "USD" as const,
        };
      },
    }),
    listContacts: operation({
      description:
        "Find contacts by name, company, or email. Look up a contact here before using its ID in another tool.",
      inputSchema: crmToolSchemas.listContacts.input,
      outputSchema: crmToolSchemas.listContacts.output,
      execute: async ({ query, status }) => {
        const pattern = query ? substringPattern(query) : undefined;
        const rows = await db
          .select({
            id: contacts.id,
            name: contacts.name,
            email: contacts.email,
            company: contacts.company,
            role: contacts.role,
            status: contacts.status,
            createdAt: contacts.createdAt,
          })
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              status ? eq(contacts.status, status) : undefined,
              pattern
                ? or(
                    ilike(contacts.name, pattern),
                    ilike(contacts.company, pattern),
                    ilike(contacts.email, pattern),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(contacts.name))
          .limit(50);
        return {
          contacts: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
          count: rows.length,
        };
      },
    }),
    createDeal: operation({
      description:
        "Create a new deal. Title and value are required. Defaults: qualified stage, no contact, expected close in 30 days. Returns the saved deal.",
      inputSchema: crmToolSchemas.createDeal.input,
      outputSchema: crmToolSchemas.createDeal.output,
      execute: async (input) => {
        const closeDate =
          input.closeDate ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        const record = {
          ...input,
          stage: input.stage ?? ("qualified" as const),
          closeDate,
          contactId: input.contactId ?? null,
        };
        const id = await createDealRecord(tenantId, record);
        return { success: true as const, deal: { ...record, id }, href: "/pipeline" };
      },
    }),
    moveDeal: operation({
      description:
        "Move or reorder a deal within the pipeline. Optionally place it before or after targetId in the destination stage. Look up IDs with listDeals first.",
      inputSchema: crmToolSchemas.moveDeal.input,
      outputSchema: crmToolSchemas.moveDeal.output,
      execute: async (input) => {
        await moveDealRecord(tenantId, input);
        return { success: true as const, id: input.id, stage: input.stage, href: "/pipeline" };
      },
    }),
    listTasks: operation({
      description:
        "View follow-up tasks, optionally searching their title and filtering by completion status.",
      inputSchema: crmToolSchemas.listTasks.input,
      outputSchema: crmToolSchemas.listTasks.output,
      execute: async ({ query, completed, contactId }) => {
        const pattern = query ? substringPattern(query) : undefined;
        const rows = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            dueDate: tasks.dueDate,
            createdAt: tasks.createdAt,
            completed: tasks.completed,
            contactId: tasks.contactId,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.tenantId, tenantId),
              contactId ? eq(tasks.contactId, contactId) : undefined,
              pattern ? ilike(tasks.title, pattern) : undefined,
              completed === undefined ? undefined : eq(tasks.completed, completed),
            ),
          )
          .orderBy(asc(tasks.dueDate))
          .limit(50);
        return {
          tasks: rows.map((row) => ({
            ...row,
            dueDate: row.dueDate.toISOString().slice(0, 10),
            createdAt: row.createdAt.toISOString(),
          })),
          count: rows.length,
        };
      },
    }),
    createTask: operation({
      description:
        "Create a follow-up task with a title and due date. Optionally link a contact found using listContacts.",
      inputSchema: crmToolSchemas.createTask.input,
      outputSchema: crmToolSchemas.createTask.output,
      execute: async (input) => {
        const record = { ...input, contactId: input.contactId ?? null };
        const id = await createTaskRecord(tenantId, record);
        return {
          success: true as const,
          task: { ...record, id, completed: false },
          href: "/tasks",
        };
      },
    }),
    setTaskCompleted: operation({
      description:
        "Mark a task complete or reopen it. Look up its ID with listTasks first. Repeating the same request does not toggle the task.",
      inputSchema: crmToolSchemas.setTaskCompleted.input,
      outputSchema: crmToolSchemas.setTaskCompleted.output,
      execute: async ({ id, completed }) => ({
        success: true as const,
        task: await setTaskCompletedRecord(tenantId, id, completed),
        href: "/tasks",
      }),
    }),
  };
}
