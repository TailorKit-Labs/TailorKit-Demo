import { revalidatePath } from "next/cache";
import { handleRpcRequest } from "@/routers/handler";

export function POST(request: Request) {
  return handleRpcRequest(request, () => revalidatePath("/", "layout"));
}
