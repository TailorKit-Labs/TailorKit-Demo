"use client";

import { RenderSlot, useViews } from "@/lib/patchsmith-client";

export function AppNavbar() {
  const { data: items } = useViews({ slot: "navbar" });
  if (!items?.length) return null;

  return (
    <div className="flex shrink-0 items-center gap-2" aria-label="App actions">
      {items.map(({ app }) => (
        <RenderSlot key={app.id} app={app} slot="navbar" />
      ))}
    </div>
  );
}
