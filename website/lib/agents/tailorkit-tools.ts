import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { dynamicTool, jsonSchema, type ToolSet, type JSONSchema7 } from "ai";
import { z } from "zod";
import { tailorKit } from "../tailorkit-server";
import { AGENT_TIMEOUT_MS } from "./agent-limits";
import { streamTailorKitAgent } from "./tailorkit-agent-stream";

export async function connectTailorKitTools(
  tenant: { id: string },
  signal: AbortSignal,
): Promise<{ tools: ToolSet; close: () => Promise<void> } | undefined> {
  if (!process.env.TAILORKIT_PROJECT_KEY) return undefined;
  const transport = await tailorKit.mcp.transport({
    scopes: { workspace: { workspaceId: tenant.id } },
  });
  const client = new Client(
    { name: "forma-crm", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(transport.url), {
        requestInit: { headers: transport.headers },
      }),
      { signal, timeout: 10000 },
    );
    let definitions = await client.listTools({}, { signal, timeout: 10000 });
    const discovered = [...definitions.tools];
    while (definitions.nextCursor) {
      definitions = await client.listTools(
        { cursor: definitions.nextCursor },
        { signal, timeout: 10000 },
      );
      discovered.push(...definitions.tools);
    }
    const tools: ToolSet = {};
    for (const definition of discovered) {
      const { name, description, inputSchema } = definition;
      // Prefix remote names so they cannot replace the CRM's tools. Discovery
      // still controls the schemas; host identity never comes from arguments.
      tools[`tailorkit_${name}`] = dynamicTool({
        description,
        // SAFETY: The MCP SDK validates tool definitions as JSON Schema objects.
        // Its extensible schema type is broader than the AI SDK's draft-7 type.
        inputSchema: jsonSchema<Record<string, unknown>>(inputSchema as JSONSchema7),
        async *execute(input, { abortSignal }) {
          const callSignal = abortSignal ? AbortSignal.any([signal, abortSignal]) : signal;
          const params = { name, arguments: z.record(z.string(), z.unknown()).parse(input) };
          if (name === "create_app" || name === "edit_app") {
            yield* streamTailorKitAgent(client, params, callSignal);
            return;
          }
          yield await client.callTool(params, { signal: callSignal, timeout: AGENT_TIMEOUT_MS });
        },
        // Include the entire final envelope so MCP isError cannot disappear.
        toModelOutput: ({ output }) => ({
          type: "text",
          value: JSON.stringify(output),
        }),
      });
    }
    return { tools, close: async () => await client.close() };
  } catch (error) {
    await client.close();
    throw error;
  }
}
