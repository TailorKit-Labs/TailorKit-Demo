import { tool } from "ai";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../drizzle";
import { contacts, deals, tasks } from "../schema";
import { createDealRecord, moveDealRecord } from "../deal-operations";
import { createTaskRecord, setTaskCompletedRecord } from "../task-operations";

const stage = z.enum(["qualified", "proposal", "negotiation", "won", "lost"]);
const date = z.iso.date().describe("A calendar date in YYYY-MM-DD format.");
const query = z.string().trim().max(120).optional();
const contactId = z
  .string()
  .min(1)
  .nullable()
  .optional()
  .describe("An ID returned by listContacts. Omit when the user has not specified a contact.");

// Only the API route supplies tenantId, after resolving the authenticated session.
// It is deliberately absent from every tool's model-visible input schema.
export function createCrmTools(tenantId: string) {
  return {
    listDeals: tool({
      description:
        "View or search the current workspace's deals, optionally by stage. Returns live records and total value in USD.",
      inputSchema: z.object({ query, stage: stage.optional() }),
      execute: async ({ query, stage }) => {
        const rows = await db
          .select({
            id: deals.id,
            title: deals.title,
            value: deals.value,
            stage: deals.stage,
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
              query
                ? or(
                    ilike(deals.title, `%${query}%`),
                    ilike(contacts.name, `%${query}%`),
                    ilike(contacts.company, `%${query}%`),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(deals.position), desc(deals.createdAt))
          .limit(50);
        return {
          deals: rows.map((row) => ({
            ...row,
            closeDate: row.closeDate.toISOString().slice(0, 10),
          })),
          count: rows.length,
          totalValue: rows.reduce((total, row) => total + row.value, 0),
          currency: "USD",
        };
      },
    }),
    listContacts: tool({
      description:
        "Find contacts by name, company, or email. Look up a contact here before using its ID in another tool.",
      inputSchema: z.object({ query }),
      execute: async ({ query }) => {
        const rows = await db
          .select({
            id: contacts.id,
            name: contacts.name,
            email: contacts.email,
            company: contacts.company,
            role: contacts.role,
            status: contacts.status,
          })
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              query
                ? or(
                    ilike(contacts.name, `%${query}%`),
                    ilike(contacts.company, `%${query}%`),
                    ilike(contacts.email, `%${query}%`),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(contacts.name))
          .limit(50);
        return { contacts: rows, count: rows.length };
      },
    }),
    createDeal: tool({
      description:
        "Create a new deal. Title and value are required. Defaults: qualified stage, no contact, expected close in 30 days. Returns the saved deal.",
      inputSchema: z.object({
        title: z.string().trim().min(2).max(120),
        value: z
          .number()
          .int()
          .min(0)
          .max(10000000)
          .describe("Value in whole US dollars, not cents."),
        stage: stage.optional(),
        closeDate: date.optional(),
        contactId,
      }),
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
    moveDeal: tool({
      description:
        "Move an existing deal to a pipeline stage. Look up its ID with listDeals first. Preserves the other details.",
      inputSchema: z.object({ id: z.string().min(1), stage }),
      execute: async (input) => {
        await moveDealRecord(tenantId, input);
        return { success: true as const, id: input.id, stage: input.stage, href: "/pipeline" };
      },
    }),
    listTasks: tool({
      description:
        "View follow-up tasks, optionally searching their title and filtering by completion status.",
      inputSchema: z.object({ query, completed: z.boolean().optional() }),
      execute: async ({ query, completed }) => {
        const rows = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            dueDate: tasks.dueDate,
            completed: tasks.completed,
            contactId: tasks.contactId,
          })
          .from(tasks)
          .where(
            and(
              eq(tasks.tenantId, tenantId),
              query ? ilike(tasks.title, `%${query}%`) : undefined,
              completed === undefined ? undefined : eq(tasks.completed, completed),
            ),
          )
          .orderBy(asc(tasks.dueDate))
          .limit(50);
        return {
          tasks: rows.map((row) => ({ ...row, dueDate: row.dueDate.toISOString().slice(0, 10) })),
          count: rows.length,
        };
      },
    }),
    createTask: tool({
      description:
        "Create a follow-up task with a title and due date. Optionally link a contact found using listContacts.",
      inputSchema: z.object({ title: z.string().trim().min(2).max(120), dueDate: date, contactId }),
      execute: async (input) => {
        const record = { ...input, contactId: input.contactId ?? null };
        const id = await createTaskRecord(tenantId, record);
        return { success: true as const, task: { ...record, id }, href: "/tasks" };
      },
    }),
    setTaskCompleted: tool({
      description:
        "Mark a task complete or reopen it. Look up its ID with listTasks first. Repeating the same request does not toggle the task.",
      inputSchema: z.object({ id: z.string().min(1), completed: z.boolean() }),
      execute: async ({ id, completed }) => ({
        success: true as const,
        task: await setTaskCompletedRecord(tenantId, id, completed),
        href: "/tasks",
      }),
    }),
  };
}
