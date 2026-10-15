import { cache } from "react";
import { ORPCError } from "@orpc/server";
import { rpc } from "./orpc.server";
import { activities, contacts, deals, tasks } from "./schema";

import { CURRENT_SETUP_VERSION } from "./provision";
export const SETUP_VERSION = CURRENT_SETUP_VERSION;
export { RECORD_LIMIT } from "./mutation-guards";
export type Contact = Omit<typeof contacts.$inferSelect, "createdAt"> & { createdAt: string };
export type Deal = Omit<typeof deals.$inferSelect, "createdAt" | "closeDate"> & {
  createdAt: string;
  closeDate: string;
};
export type Task = Omit<typeof tasks.$inferSelect, "createdAt" | "dueDate"> & {
  createdAt: string;
  dueDate: string;
};
export type Activity = Omit<typeof activities.$inferSelect, "createdAt"> & { createdAt: string };
export type Workspace = {
  tenant: { id: string; name: string; setupVersion: number };
  contacts: Contact[];
  deals: Deal[];
  tasks: Task[];
  activities: Activity[];
};
export { getCurrentSession, requireTenant } from "./workspace-session";

// React.cache deduplicates layout/page reads within one server render. The
// server client calls the router directly, without HTTP.
export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  try {
    return await rpc.workspace.snapshot();
  } catch (error) {
    if (error instanceof ORPCError && (error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN"))
      return null;
    throw error;
  }
});
