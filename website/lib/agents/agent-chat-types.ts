import type { CrmAgentMessage } from "./crm-agent";

export type AgentChatSummary = { id: string; title: string; updatedAt: string };
export type SavedAgentChat = AgentChatSummary & { messages: CrmAgentMessage[] };

export type AgentHistory = {
  chats: AgentChatSummary[];
  latest: SavedAgentChat | null;
};
