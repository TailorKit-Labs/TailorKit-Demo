import { AppsPanelTrigger } from "@/components/agent/apps-panel-context";

export function AppPageHeading({ children }: { children: React.ReactNode }) {
  return (
    <header
      data-slot="page-navbar"
      className="sticky top-0 z-10 order-first -mx-4 flex shrink-0 items-center gap-3 border-b border-transparent bg-background px-4 py-3.5 transition-[border-color] data-[scrolled=true]:border-border md:-mx-6 md:px-6"
    >
      <div className="min-w-0 flex-1">{children}</div>
      <AppsPanelTrigger />
    </header>
  );
}
