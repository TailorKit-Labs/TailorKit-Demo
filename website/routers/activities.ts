import { aiSdkTool } from "@orpc/ai-sdk";

import { and, desc, eq } from "drizzle-orm";
import { db } from "../lib/drizzle";
import { activities } from "../lib/schema";
import { protectedProcedure } from "./base";
import { schemas } from "./schemas";
import { checkContact, lockTenant, logActivity } from "./shared";

export const listActivities = protectedProcedure
  .meta(
    aiSdkTool({
      description: "Read the latest workspace activity and notes, optionally for one contact.",
    }),
  )
  .input(schemas.activities.list.input)
  .output(schemas.activities.list.output)
  .handler(async ({ input, context }) => {
    const tenantId = context.tenant.id;
    const { contactId } = input;

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
  });

export const addNote = protectedProcedure
  .meta(
    aiSdkTool({
      description:
        "Add a note to an existing contact. Notes appear in the contact's activity history.",
    }),
  )
  .input(schemas.activities.addNote.input)
  .output(schemas.activities.addNote.output)
  .handler(async ({ input: { contactId, body }, context }) => {
    const tenantId = context.tenant.id;
    const id = await db.transaction(async (tx) => {
      await lockTenant(tx, tenantId);
      await checkContact(tx, tenantId, contactId);
      return logActivity(tx, tenantId, "note", "Note added", body, contactId);
    });
    return { success: true as const, id, href: `/contacts/${contactId}` };
  });
