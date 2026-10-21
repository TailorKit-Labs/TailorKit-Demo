"use client";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { AppMobileHeader } from "@/components/app/app-mobile-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AgentWorkspace } from "@/components/agent/agent-workspace";
import { PatchsmithProvider, useViewContext } from "@/lib/patchsmith-client";
import { DemoIntroProvider } from "@/components/demo-intro/demo-intro-provider";
import { cn } from "@/lib/utils";

export function CrmShell({
  children,
  name,
  workspaceId,
}: {
  children: React.ReactNode;
  name: string;
  workspaceId: string;
}) {
  const pathname = usePathname();
  const appPage = pathname.startsWith("/app-pages/");
  return (
    <PatchsmithProvider key={workspaceId}>
      <WorkspaceContext workspaceId={workspaceId} name={name} />
      <DemoIntroProvider key={workspaceId} workspaceId={workspaceId}>
        <SidebarProvider
          className="h-dvh min-h-0 overflow-hidden"
          style={{ "--sidebar-width": "17rem" } as CSSProperties}
        >
          <AppMobileHeader name={name} />
          <AppSidebar name={name} />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sidebar max-[799px]:pt-14">
            <AgentWorkspace>
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
                <div
                  className={cn(
                    "flex flex-col gap-6 px-4 pb-5 max-[799px]:pb-24 md:px-6 md:pb-8",
                    appPage && "h-full gap-4",
                  )}
                >
                  {children}
                </div>
              </div>
            </AgentWorkspace>
          </main>
        </SidebarProvider>
      </DemoIntroProvider>
    </PatchsmithProvider>
  );
}

function WorkspaceContext({ workspaceId, name }: { workspaceId: string; name: string }) {
  const page = usePathname();
  useViewContext("/", { context: { workspace: { id: workspaceId, name }, page } });
  return null;
}
