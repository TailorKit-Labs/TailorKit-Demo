import { getTenant } from "@/lib/workspace-session";
import { orpc } from "@/lib/orpc.server";
import { HydrateClient, prefetch } from "@/lib/query.server";
import { CrmPages } from "@/components/crm-pages";
import { prefetchViews } from "@/lib/patchsmith-queries.server";
export const metadata = { title: "Workspace" };
export default async function Page() {
  const tenant = await getTenant();
  if (!tenant) return null;
  void prefetch(orpc.workspace.snapshot.queryOptions());
  void prefetchViews(tenant, "page", "/settings");
  return (
    <HydrateClient>
      <CrmPages view="settings" />
    </HydrateClient>
  );
}
