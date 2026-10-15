import { getTenant } from "@/lib/workspace-session";
import { orpc } from "@/lib/orpc.server";
import { HydrateClient, prefetch } from "@/lib/query.server";
import { CrmPages } from "@/components/crm-pages";
export const metadata = { title: "Follow-ups" };
export default async function Page() {
  if (!(await getTenant())) return null;
  void prefetch(orpc.workspace.snapshot.queryOptions());
  return (
    <HydrateClient>
      <CrmPages view="tasks" />
    </HydrateClient>
  );
}
