import { createRouterClient } from "@orpc/server";
import { router } from "./router";
import { tenantFromVerifiedId } from "./auth";

// Never pass a tenant ID from an HTTP body or model arguments to this factory.
export function createWorkspaceRpcClient(tenantId: string, onMutation?: () => void) {
  return createRouterClient(router, {
    context: { resolveTenant: () => tenantFromVerifiedId(tenantId), onMutation },
  });
}
