import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  try {
    const source = await readFile(
      path.join(process.cwd(), "../apps/doom/.patchsmith/client/client.js"),
      "utf8",
    );
    return new Response(source, {
      headers: { "Content-Type": "text/javascript", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("Build Doom first: pnpm --filter @demo/doom build", { status: 503 });
  }
}
