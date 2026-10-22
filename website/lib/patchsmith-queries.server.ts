import { patchsmith } from "./patchsmith-server";
import { patchsmithOrigin } from "./patchsmith-origin";
import { requireTenant, requireUserId } from "./workspace-session";
import { prefetch } from "./query.server";
import {
  viewsQueryOptions,
  type ViewsApi,
  type ViewSlot,
  type ViewWorkspace,
} from "./patchsmith-queries";

// Invoke the authenticated host in process: no browser cookie forwarding or
// HTTP round trip back to our own Next.js server. Identity is resolved per RSC
// request, and the normal handler still validates and authorizes every input.
const api: ViewsApi = {
  async views({ signal, ...input }) {
    const response = await patchsmith.handler(
      new Request(new URL("/api/patchsmith/views", patchsmithOrigin()), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
      }),
      {
        authenticate: async () => {
          const [tenant, subjectId] = await Promise.all([requireTenant(), requireUserId()]);
          return { subjectId, scopes: { workspace: { workspaceId: tenant.id } } };
        },
      },
    );
    if (!response.ok) throw new Error("Unable to load app views.");
    return response.json();
  },
};

export function prefetchViews(workspace: ViewWorkspace, slot: ViewSlot, pathname = "/") {
  return prefetch(viewsQueryOptions(api, workspace, slot, pathname));
}
