"use client";

import { createContext, useContext, type ReactNode } from "react";
import { patchsmithClient, useViewContext, useViews } from "@/lib/patchsmith-client";

const AppPagesContext = createContext<ReturnType<typeof usePageCatalog> | null>(null);

function usePageCatalog() {
  return useViews({ slot: "page" });
}

// Page instances form a workspace catalog. Give discovery its own SDK store so
// route context changes cannot replace the catalog query with an empty one.
// The nested PatchsmithProvider in CrmShell owns the live rendering context.
export function AppPagesProvider({
  children,
  workspaceId,
  name,
}: {
  children: ReactNode;
  workspaceId: string;
  name: string;
}) {
  return (
    <patchsmithClient.Provider>
      <AppPagesCatalog workspaceId={workspaceId} name={name}>
        {children}
      </AppPagesCatalog>
    </patchsmithClient.Provider>
  );
}

function AppPagesCatalog({
  children,
  workspaceId,
  name,
}: {
  children: ReactNode;
  workspaceId: string;
  name: string;
}) {
  useViewContext("/", { context: { workspace: { id: workspaceId, name }, page: "/" } });
  const pages = usePageCatalog();
  return <AppPagesContext.Provider value={pages}>{children}</AppPagesContext.Provider>;
}

export function useAppPages() {
  const pages = useContext(AppPagesContext);
  if (!pages) throw new Error("useAppPages must be used within AppPagesProvider");
  return pages;
}
