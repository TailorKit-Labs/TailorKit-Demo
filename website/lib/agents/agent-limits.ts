// Leave time for MCP discovery, chat persistence, and token settlement within
// the route's five-minute function limit. Leases outlive that entire invocation.
export const AGENT_TIMEOUT_MS = 270000;
export const AGENT_LEASE_MS = 330000;
