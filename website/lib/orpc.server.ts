import { createRouterClient } from "@orpc/server";
import { router } from "./rpc/router";
import { requireTenant } from "./workspace-session";

// Only the stateless client is shared. Auth is resolved afresh per invocation,
// and React.cache deduplicates it only within the active server render.
export const rpc = createRouterClient(router, {
  context: () => ({ resolveTenant: requireTenant }),
});
