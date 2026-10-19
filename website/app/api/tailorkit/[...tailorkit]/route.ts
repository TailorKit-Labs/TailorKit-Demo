import { tailorKit } from "@/lib/tailorkit-server";
import { requireTenant, requireUserId } from "@/lib/workspace-session";

async function handleRequest(request: Request) {
  return tailorKit.handler(request, {
    authenticate: async () => {
      try {
        const tenant = await requireTenant();
        return {
          subjectId: await requireUserId(),
          scopes: { workspace: { workspaceId: tenant.id } },
        };
      } catch {
        return null;
      }
    },
  });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const OPTIONS = handleRequest;
