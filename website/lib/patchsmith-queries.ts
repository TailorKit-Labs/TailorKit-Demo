import { queryOptions } from "@tanstack/react-query";
import type { PatchsmithClientConfig, SlotItem } from "patchsmith/react";

export type ViewsApi = Pick<PatchsmithClientConfig["api"], "views">;
export type ViewSlot = "page" | "panel" | "navbar";
export type ViewWorkspace = { id: string; name: string };

export const patchsmithQueryKey = ["patchsmith", "views"] as const;

export function viewsQueryOptions<TSlot extends ViewSlot>(
  api: ViewsApi,
  workspace: ViewWorkspace,
  slot: TSlot,
  pathname: string,
) {
  // Only the multiple page slot resolves instances from context. Single slots
  // discover apps independently of the active view; their renderers supply it.
  const activeView =
    slot === "page"
      ? {
          view: "/",
          layers: [
            {
              path: "/",
              status: "ready" as const,
              context: { workspace: { id: workspace.id, name: workspace.name }, page: pathname },
            },
          ],
        }
      : null;

  return queryOptions({
    queryKey: [...patchsmithQueryKey, workspace.id, slot, activeView] as const,
    queryFn: async ({ signal }) => {
      const result = await api.views({ slot, activeView, signal });
      if (result.status !== "ready") throw new Error("App views are not ready. Please try again.");
      return result;
    },
    select: (result): SlotItem<TSlot extends "page" ? true : false>[] => {
      // The host contract guarantees instances for page and app-only items for
      // single slots. Keep the SDK's slot-specific types at our query boundary.
      return result.data as SlotItem<TSlot extends "page" ? true : false>[];
    },
  });
}
