import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./drizzle";
import { tasks } from "./schema";
import { checkContact, checkLimit, lockTenant, logActivity } from "./mutation-guards";

export const taskInput = z.object({
  title: z.string().trim().min(2).max(120),
  dueDate: z.coerce.date(),
  contactId: z.string().nullable(),
});

export async function createTaskRecord(tenantId: string, input: z.input<typeof taskInput>) {
  const data = taskInput.parse(input);
  return db.transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    await checkLimit(tx, tasks, tenantId);
    await checkContact(tx, tenantId, data.contactId);
    const id = crypto.randomUUID();
    await tx.insert(tasks).values({ ...data, id, tenantId });
    await logActivity(tx, tenantId, "task", "Task added", data.title, data.contactId);
    return id;
  });
}

export async function setTaskCompletedRecord(tenantId: string, id: string, completed: boolean) {
  const rows = await db
    .update(tasks)
    .set({ completed })
    .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
    .returning({ id: tasks.id, title: tasks.title, completed: tasks.completed });
  if (!rows.length) throw new Error("Task not found.");
  return rows[0];
}
