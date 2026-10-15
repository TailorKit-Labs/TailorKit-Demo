"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "./drizzle";
import { tasks } from "./schema";
import { getCurrentSession, requireTenant } from "./workspace";
import { provisionForUser } from "./provision";
import { addNoteRecord } from "./activity-operations";
import {
  createDealRecord,
  updateDealRecord,
  deleteDealRecord,
  dealInput,
  moveDealRecord,
  type MoveDealInput,
} from "./deal-operations";
import { createTaskRecord, updateTaskRecord, deleteTaskRecord, taskInput } from "./task-operations";
import {
  createContactRecord,
  updateContactRecord,
  deleteContactRecord,
  contactInput,
} from "./contact-operations";

export type ActionResult = { success: true; id?: string } | { success: false; error: string };
async function action(fn: () => Promise<void | string>): Promise<ActionResult> {
  try {
    const id = await fn();
    revalidatePath("/", "layout");
    return { success: true, ...(id ? { id } : {}) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof z.ZodError
          ? error.issues[0].message
          : error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
    };
  }
}
export async function provisionWorkspace(): Promise<ActionResult> {
  try {
    const session = await getCurrentSession();
    if (!session) throw new Error("Please create your demo account first.");
    await provisionForUser(session.user.id);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Workspace setup failed. Please try again.",
    };
  }
}
export async function createContact(input: z.input<typeof contactInput>) {
  return action(async () => {
    const tenant = await requireTenant();
    return createContactRecord(tenant.id, input);
  });
}
export async function updateContact(id: string, input: z.input<typeof contactInput>) {
  return action(async () => {
    const tenant = await requireTenant();
    await updateContactRecord(tenant.id, id, input);
  });
}
export async function deleteContact(id: string) {
  return action(async () => {
    const tenant = await requireTenant();
    await deleteContactRecord(tenant.id, id);
  });
}
export async function createDeal(input: z.input<typeof dealInput>) {
  return action(async () => {
    const tenant = await requireTenant();
    return createDealRecord(tenant.id, input);
  });
}
export async function updateDeal(id: string, input: z.input<typeof dealInput>) {
  return action(async () => {
    const tenant = await requireTenant();
    await updateDealRecord(tenant.id, id, input);
  });
}
export async function deleteDeal(id: string) {
  return action(async () => {
    const tenant = await requireTenant();
    await deleteDealRecord(tenant.id, id);
  });
}
export async function movePipelineDeal(input: MoveDealInput) {
  return action(async () => {
    const tenant = await requireTenant();
    await moveDealRecord(tenant.id, input);
  });
}
export async function createTask(input: z.input<typeof taskInput>) {
  return action(async () => {
    const tenant = await requireTenant();
    return createTaskRecord(tenant.id, input);
  });
}
export async function toggleTask(id: string) {
  return action(async () => {
    const tenant = await requireTenant();
    const rows = await db
      .update(tasks)
      .set({ completed: sql`not ${tasks.completed}` })
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenant.id)))
      .returning({ id: tasks.id });
    if (!rows.length) throw new Error("Task not found.");
  });
}
export async function deleteTask(id: string) {
  return action(async () => {
    const tenant = await requireTenant();
    await deleteTaskRecord(tenant.id, id);
  });
}
export async function addNote(contactId: string, body: string) {
  return action(async () => {
    const tenant = await requireTenant();
    await addNoteRecord(tenant.id, contactId, body);
  });
}

export async function updateTask(id: string, input: z.input<typeof taskInput>) {
  return action(async () => {
    const tenant = await requireTenant();
    await updateTaskRecord(tenant.id, id, input);
  });
}
