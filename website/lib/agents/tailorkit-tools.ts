import { createMCPClient } from "@ai-sdk/mcp";
import { tailorKit } from "../tailorkit-server";

export async function connectTailorKitTools(tenant: { id: string }, signal: AbortSignal) {
  if (!process.env.TAILORKIT_PROJECT_KEY) return undefined;
  const transport = await tailorKit.mcp.transport({
    scopes: { workspace: { workspaceId: tenant.id } },
  });
  const client = await createMCPClient({
    transport: { type: "http", ...transport },
    initializationOptions: { signal, timeout: 10000 },
  });
  try {
    let definitions = await client.listTools({ options: { signal, timeout: 10000 } });
    const discovered = [...definitions.tools];
    while (definitions.nextCursor) {
      definitions = await client.listTools({
        params: { cursor: definitions.nextCursor },
        options: { signal, timeout: 10000 },
      });
      discovered.push(...definitions.tools);
    }
    const tools = client.toolsFromDefinitions({ ...definitions, tools: discovered });
    for (const tool of Object.values(tools)) {
      const toModelOutput = tool.toModelOutput;
      if (!toModelOutput) continue;
      tool.toModelOutput = async (options) => {
        const converted = await toModelOutput(options);
        if (converted.type !== "content") return converted;
        // The SDK's content conversion omits the MCP envelope's error status.
        return {
          ...converted,
          value: [
            { type: "text", text: JSON.stringify({ isError: options.output.isError === true }) },
            ...converted.value,
          ],
        };
      };
    }
    // Prefix remote names so they cannot replace the CRM's tools.
    return {
      tools: Object.fromEntries(
        Object.entries(tools).map(([name, tool]) => [`tailorkit_${name}`, tool]),
      ),
      close: () => client.close(),
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
