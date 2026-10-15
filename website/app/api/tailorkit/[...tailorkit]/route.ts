import { tailorKit } from "@/lib/tailorkit-server";
import { getWorkspace } from "@/lib/workspace";

async function handleRequest(request: Request) {
  return tailorKit.handler(request, {
    authenticate: async () => {
      const workspace = await getWorkspace();
      if (!workspace) return null;
      return { scopes: { workspace: { workspaceId: workspace.tenant.id } } };
    },
  });
}

export const GET = handleRequest;
export const POST = handleRequest;
