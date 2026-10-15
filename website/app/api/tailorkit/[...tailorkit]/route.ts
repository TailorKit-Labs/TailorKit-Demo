import { tailorKit } from "@/lib/tailorkit-server";
import { requireTenant } from "@/lib/workspace";

async function handleRequest(request: Request) {
  return tailorKit.handler(request, {
    authenticate: async () => {
      try {
        const tenant = await requireTenant();
        return { scopes: { workspace: { workspaceId: tenant.id } } };
      } catch {
        return null;
      }
    },
  });
}

export const GET = handleRequest;
export const POST = handleRequest;
