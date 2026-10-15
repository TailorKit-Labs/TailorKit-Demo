import type { activities, contacts, deals, tasks } from "./schema";

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
