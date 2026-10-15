import { getTenant } from "@/lib/workspace-session";
import { CrmShell } from "@/components/crm-shell";
import { DemoSetup } from "@/components/demo-setup";
import { orpc } from "@/lib/orpc.server";
import { HydrateClient, prefetch } from "@/lib/query.server";
import { QueryProvider } from "@/lib/query-provider";

export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();
  if (!tenant)
    return (
      <QueryProvider key="setup">
        <DemoSetup />
      </QueryProvider>
    );
  void prefetch(orpc.chats.list.queryOptions());
  return (
    <QueryProvider key={tenant.id}>
      <HydrateClient>
        <CrmShell name={tenant.name} workspaceId={tenant.id}>
          {children}
        </CrmShell>
      </HydrateClient>
    </QueryProvider>
  );
}
