import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { router } from "./rpc/router";

// Browser transport only. Server-rendered data uses ./orpc.server directly,
// keeping request APIs and database code out of the client SSR/module graph.
const link = new RPCLink({
  url: "/rpc",
  origin: () => {
    if (typeof window === "undefined")
      throw new Error("The browser RPC link cannot run during SSR.");
    return window.location.origin;
  },
});
export const rpc: RouterClient<typeof router> = createORPCClient(link);
