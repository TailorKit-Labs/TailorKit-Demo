import { RPCHandler } from "@orpc/server/fetch";
import { RequestLimitHandlerPlugin } from "@orpc/server/plugins";
import { router } from "./router";
import { tenantFromHeaders } from "./auth";

const handler = new RPCHandler(router, {
  plugins: [new RequestLimitHandlerPlugin({ maxBodySize: 60000 })],
});

export async function handleRpcRequest(request: Request, onMutation?: () => void) {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  // Cookie-authenticated mutations retain the same-origin protection previously
  // supplied by Next server actions. Server callers use the direct client.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("This request is not allowed.", { status: 403 });
  const { response } = await handler.handle(request, {
    prefix: "/rpc",
    context: { resolveTenant: () => tenantFromHeaders(request.headers), onMutation },
  });
  const result = response ?? new Response("Not found", { status: 404 });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
