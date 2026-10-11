import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./drizzle";
import { deals } from "./schema";
import { checkContact, checkLimit, lockTenant, logActivity } from "./mutation-guards";

export const dealInput = z.object({
  title: z.string().trim().min(2).max(120),
  contactId: z.string().nullable(),
  value: z.coerce.number().int().min(0).max(10000000),
  stage: z.enum(["qualified", "proposal", "negotiation", "won", "lost"]),
  closeDate: z.coerce.date(),
});

export async function createDealRecord(tenantId: string, input: z.input<typeof dealInput>) {
  const data = dealInput.parse(input);
  return db.transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    await checkLimit(tx, deals, tenantId);
    await checkContact(tx, tenantId, data.contactId);
    const id = crypto.randomUUID();
    await tx.insert(deals).values({ ...data, id, tenantId });
    await logActivity(tx, tenantId, "deal", "Deal created", data.title, data.contactId);
    return id;
  });
}

const moveInput = z.object({
  id: z.string().min(1),
  stage: z.enum(["qualified", "proposal", "negotiation", "won", "lost"]),
  targetId: z.string().min(1).optional(),
  placement: z.enum(["before", "after"]).default("before"),
});
export type MoveDealInput = z.input<typeof moveInput>;

// actions.ts supplies the tenant from the authenticated session, never from client input.
export async function moveDealRecord(tenantId: string, input: MoveDealInput) {
  const move = moveInput.parse(input);
  await db.transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const records = await tx
      .select()
      .from(deals)
      .where(eq(deals.tenantId, tenantId))
      .orderBy(asc(deals.position), desc(deals.createdAt), asc(deals.id));
    const source = records.find((deal) => deal.id === move.id);
    if (!source) throw new Error("Deal not found.");
    if (move.targetId === source.id) return;
    const destination = records.filter((deal) => deal.stage === move.stage && deal.id !== move.id);
    const targetIndex = move.targetId
      ? destination.findIndex((deal) => deal.id === move.targetId)
      : destination.length;
    if (targetIndex < 0)
      throw new Error("The destination deal is no longer in this stage. Please try again.");
    const insertIndex = targetIndex + (move.targetId && move.placement === "after" ? 1 : 0);
    destination.splice(insertIndex, 0, source);
    for (const [position, deal] of destination.entries()) {
      await tx
        .update(deals)
        .set({ stage: move.stage, position })
        .where(and(eq(deals.id, deal.id), eq(deals.tenantId, tenantId)));
    }
    if (source.stage !== move.stage) {
      await logActivity(
        tx,
        tenantId,
        "deal",
        "Deal updated",
        `${source.title} moved to ${move.stage}.`,
        source.contactId,
      );
    }
  });
}
