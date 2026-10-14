"use client";

import { useRef, useState } from "react";
import { Reorder, useDragControls, MotionConfig } from "motion/react";
import { CalendarDaysIcon, CheckIcon, MousePointer2Icon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const demoApps = [
  { id: "todo", name: "Todo" },
  { id: "stripe", name: "Stripe" },
  { id: "notion", name: "Notion" },
  { id: "calendar", name: "Calendar" },
];
export type PanelApp = (typeof demoApps)[number];

const tabClassName =
  "h-9 grow-0 gap-2 rounded-lg border-0 px-2 font-normal text-sm text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground sm:h-9";

function AppLogo({ id }: { id: string }) {
  switch (id) {
    case "todo":
      return (
        <span className="flex size-4 items-center justify-center rounded-sm bg-[#e44332] text-white">
          <CheckIcon className="size-3" />
        </span>
      );
    case "stripe":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <rect width="24" height="24" rx="5" fill="#635bff" />
          <path
            fill="white"
            d="M13 8.4c-1.3 0-1.9.3-1.9.9 0 1.6 6.2.7 6.2 5.2 0 2.5-2 3.8-4.8 3.8-1.4 0-2.9-.3-4-.9v-3.1c1.2.7 2.8 1.2 4.1 1.2 1.1 0 1.8-.3 1.8-.9 0-1.8-6.2-.8-6.2-5.1 0-2.4 1.9-3.8 4.6-3.8 1.4 0 2.7.3 3.8.7v3c-1.1-.6-2.4-1-3.6-1Z"
          />
        </svg>
      );
    case "notion":
      return (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="white" />
          <path d="M6 18V6h3l6 8V6h3v12h-3L9 10v8Z" fill="#191919" />
        </svg>
      );
    default:
      return <CalendarDaysIcon className="size-4 text-[#4285f4]" />;
  }
}

function AppTab({ app, onMove }: { app: PanelApp; onMove: (id: string, offset: number) => void }) {
  const controls = useDragControls();
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Reorder.Item
      as="div"
      value={app}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => {
        dragging.current = true;
        setIsDragging(true);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        requestAnimationFrame(() => {
          dragging.current = false;
        });
      }}
      className="relative shrink-0"
    >
      <TabsTab
        value={app.id}
        title={`${app.name} — drag or use Alt + arrow keys to reorder`}
        className={cn(tabClassName, "touch-pan-x", isDragging && "cursor-grabbing")}
        onPointerDown={(event) => controls.start(event)}
        onClick={(event) => {
          if (dragging.current) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
            event.preventDefault();
            onMove(app.id, event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <span aria-hidden="true">
          <AppLogo id={app.id} />
        </span>
        {app.name}
      </TabsTab>
    </Reorder.Item>
  );
}

export function AppsPanel({
  children,
  apps,
  onReorder,
  activeTab,
  onTabChange,
}: {
  children: React.ReactNode;
  apps: PanelApp[];
  onReorder: (apps: PanelApp[]) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  function moveApp(id: string, offset: number) {
    const index = apps.findIndex((app) => app.id === id);
    const target = index + offset;
    if (target < 0 || target >= apps.length) return;
    const next = [...apps];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  }

  return (
    <MotionConfig reducedMotion="user">
      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(String(value))}
        className="h-full min-h-0 w-full min-w-0 gap-0 overflow-hidden"
      >
        <div className="flex min-w-0 shrink-0 items-center border-b px-2 py-3">
          <TabsList
            aria-label="Agent and apps"
            className="min-w-0 flex-1 justify-start bg-transparent p-0 [&>[data-slot=tab-indicator]]:hidden"
          >
            <TabsTab value="agent" className={tabClassName}>
              <MousePointer2Icon className="size-4" aria-hidden="true" />
              Agent
            </TabsTab>
            <Separator orientation="vertical" className="mx-0.5 h-5" />
            <Reorder.Group
              as="div"
              axis="x"
              values={apps}
              onReorder={onReorder}
              layoutScroll
              className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {apps.map((app) => (
                <AppTab key={app.id} app={app} onMove={moveApp} />
              ))}
            </Reorder.Group>
          </TabsList>
        </div>
        <TabsPanel value="agent" keepMounted className="min-h-0 data-[hidden]:hidden">
          {children}
        </TabsPanel>
        {apps.map((app) => (
          <TabsPanel key={app.id} value={app.id} className="min-h-0" />
        ))}
      </Tabs>
    </MotionConfig>
  );
}
