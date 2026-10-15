import { getWorkspace } from "@/lib/workspace";
import { CrmShell } from "@/components/crm-shell";
import { DemoSetup } from "@/components/demo-setup";
import { loadAgentHistory } from "@/lib/agents/agent-chat-store";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace) return <DemoSetup />;
  const agentHistory = await loadAgentHistory(workspace.tenant.id);
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
