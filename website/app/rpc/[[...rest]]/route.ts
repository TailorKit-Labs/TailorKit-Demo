import { revalidatePath } from "next/cache";
import { handleRpcRequest } from "@/lib/rpc/handler";

export function POST(request: Request) {
  return handleRpcRequest(request, () => revalidatePath("/", "layout"));
}
