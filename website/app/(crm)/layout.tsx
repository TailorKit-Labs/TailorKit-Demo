import { getWorkspace } from "@/lib/workspace";
import { CrmShell } from "@/components/crm-shell";
import { DemoSetup } from "@/components/demo-setup";
import { rpc } from "@/lib/orpc.server";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace) return <DemoSetup />;
  const agentHistory = await rpc.chats.list();
  return (
    <CrmShell
      name={workspace.tenant.name}
      workspaceId={workspace.tenant.id}
      agentHistory={agentHistory}
    >
      {children}
    </CrmShell>
  );
}
