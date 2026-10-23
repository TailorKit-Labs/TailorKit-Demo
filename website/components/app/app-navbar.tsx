"use client";

import { useQuery } from "@tanstack/react-query";
import { RenderSlot, useViewQueryOptions } from "@/lib/patchsmith-client";

export function AppNavbar() {
  const { data: items } = useQuery(useViewQueryOptions("navbar"));
  if (!items?.length) return null;

  return (
    <div className="flex shrink-0 items-center gap-2" aria-label="App actions">
      {items.map(({ app }) => (
        <RenderSlot key={app.id} app={app} slot="navbar" />
      ))}
    </div>
  );
}
