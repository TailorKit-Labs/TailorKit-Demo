"use client";

import { createContext, useContext } from "react";
import { PanelRightOpenIcon, PanelRightCloseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const AppsPanelContext = createContext<{
  open: boolean;
  panelId: string;
  toggle: () => void;
} | null>(null);

export function AppsPanelTrigger() {
  const panel = useContext(AppsPanelContext);
  if (!panel) return null;

  return (
    <div className="hidden shrink-0 items-center gap-3 min-[800px]:flex">
      <Separator orientation="vertical" className="h-5" />
      <Button
        variant="ghost"
        size="icon"
        aria-label={panel.open ? "Close apps panel" : "Open apps panel"}
        aria-expanded={panel.open}
        aria-controls={panel.open ? panel.panelId : undefined}
        title={panel.open ? "Close apps panel" : "Open apps panel"}
        onClick={panel.toggle}
      >
        {panel.open ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
      </Button>
    </div>
  );
}
