"use client";

import { useState } from "react";
import {
  DrawerBackdrop,
  DrawerContent,
  DrawerClose,
  DrawerPortal,
  DrawerPrimitive,
  DrawerTitle,
  DrawerViewport,
} from "@/components/ui/drawer";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export function MobileAppsDrawer({
  children,
  panelId,
}: {
  children: React.ReactNode;
  panelId: string;
}) {
  const [layout, setLayout] = useState({ space: 0, apps: 100 });
  return (
    <DrawerPortal>
      <DrawerBackdrop />
      <DrawerViewport position="bottom">
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          className="pointer-events-none relative row-start-2 h-[calc(100dvh-3rem)] min-h-0 min-w-0 w-full outline-none transition-transform duration-450 ease-[cubic-bezier(0.32,0.72,0,1)] data-starting-style:translate-y-full data-ending-style:translate-y-full"
        >
          <DrawerContent className="h-full min-h-0 min-w-0">
            <ResizablePanelGroup
              orientation="vertical"
              className="min-w-0"
              defaultLayout={layout}
              onLayoutChanged={(next) => setLayout({ space: next.space, apps: next.apps })}
            >
              <ResizablePanel id="space" defaultSize="0%" minSize="0%" maxSize="60%">
                <DrawerClose
                  aria-label="Close apps drawer"
                  className="pointer-events-auto size-full cursor-default"
                />
              </ResizablePanel>
              <ResizableHandle
                aria-label="Resize apps drawer"
                className="pointer-events-auto touch-none rounded-t-2xl border-t bg-popover before:h-1 before:w-12 before:rounded-full before:bg-input aria-[orientation=horizontal]:h-8 after:hidden"
              />
              <ResizablePanel
                id="apps"
                defaultSize="100%"
                minSize="40%"
                className="pointer-events-auto bg-popover"
              >
                <DrawerTitle className="sr-only">Agent and apps</DrawerTitle>
                <div
                  id={panelId}
                  className="h-full min-h-0 min-w-0 touch-auto overflow-hidden pb-[env(safe-area-inset-bottom)]"
                >
                  {children}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </DrawerContent>
        </DrawerPrimitive.Popup>
      </DrawerViewport>
    </DrawerPortal>
  );
}
