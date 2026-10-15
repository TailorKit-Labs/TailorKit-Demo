"use client";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { AppMobileHeader } from "@/components/app/app-mobile-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AgentWorkspace } from "@/components/agent/agent-workspace";
import { TailorKitProvider, useViewContext } from "@/lib/tailorkit-client";
import type { AgentHistory } from "@/lib/agents/agent-chat-types";

export function CrmShell({
  children,
  name,
  agentHistory,
  workspaceId,
}: {
  children: React.ReactNode;
  name: string;
  agentHistory: AgentHistory;
  workspaceId: string;
}) {
  const pathname = usePathname();
  return (
    <TailorKitProvider key={workspaceId}>
      <WorkspaceContext workspaceId={workspaceId} name={name} />
      <SidebarProvider
        className="h-dvh min-h-0 overflow-hidden"
        style={{ "--sidebar-width": "17rem" } as CSSProperties}
      >
        <AppMobileHeader name={name} />
        <AppSidebar name={name} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sidebar max-[799px]:pt-14">
          <AgentWorkspace initialHistory={agentHistory}>
            <div
              key={pathname}
              data-slot="page-content"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              onScroll={(event) => {
                const header = event.currentTarget.querySelector<HTMLElement>(
                  '[data-slot="page-navbar"]',
                );
                if (header) header.dataset.scrolled = String(event.currentTarget.scrollTop > 0);
              }}
            >
              <div className="flex flex-col gap-6 px-4 pb-5 max-[799px]:pb-24 md:px-6 md:pb-8">
                {children}
              </div>
            </div>
          </AgentWorkspace>
        </main>
      </SidebarProvider>
    </TailorKitProvider>
  );
}

function WorkspaceContext({ workspaceId, name }: { workspaceId: string; name: string }) {
  const page = usePathname();
  useViewContext("/", { context: { workspace: { id: workspaceId, name }, page } });
  return null;
}
