import { handleRpcRequest } from "@/routers/handler";

export function POST(request: Request) {
  return handleRpcRequest(request);
}
