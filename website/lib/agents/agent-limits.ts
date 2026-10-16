// Leave time for MCP discovery and chat persistence within the RPC route's
// five-minute function limit. The chat lease outlives that entire invocation.
export const AGENT_TIMEOUT_MS = 270000;
export const AGENT_LEASE_MS = 330000;
