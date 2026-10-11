"use client";
import { useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { PageHeaderContext } from "@/components/app/app-page-header";
import { AppMobileFooter } from "@/components/app/app-mobile-footer";
import { AppMobileHeader } from "@/components/app/app-mobile-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AgentWorkspace } from "@/components/agent/agent-workspace";

export function CrmShell({ children, name }: { children: React.ReactNode; name: string }) {
  const pathname = usePathname();
  const [header, setHeader] = useState<HTMLElement | null>(null);
  return (
    <SidebarProvider
      className="h-dvh min-h-0 overflow-hidden"
      style={{ "--sidebar-width": "17rem" } as CSSProperties}
    >
      <AppMobileHeader name={name} />
      <AppSidebar name={name} />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-sidebar max-md:pt-14 max-md:pb-20 md:shadow-none">
        <AgentWorkspace>
          <header
            key={pathname}
            ref={setHeader}
            data-slot="page-navbar"
            className="z-10 shrink-0 border-b border-transparent bg-background px-5 py-3.5 transition-[border-color] empty:hidden data-[scrolled=true]:border-border md:px-8"
          />
          <PageHeaderContext value={header}>
            <div
              key={pathname}
              data-slot="page-content"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              onScroll={(event) => {
                if (header) header.dataset.scrolled = String(event.currentTarget.scrollTop > 0);
              }}
            >
              <div className="mt-4 flex flex-col gap-6 px-5 pb-5 md:mt-6 md:px-8 md:pb-8">
                {children}
              </div>
            </div>
          </PageHeaderContext>
        </AgentWorkspace>
      </SidebarInset>
      <AppMobileFooter />
    </SidebarProvider>
  );
}
