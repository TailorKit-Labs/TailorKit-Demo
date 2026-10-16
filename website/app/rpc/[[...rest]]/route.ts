import { after } from "next/server";
import { handleRpcRequest } from "@/routers/handler";

export const maxDuration = 300;

export function POST(request: Request) {
  return handleRpcRequest(request, after);
}
