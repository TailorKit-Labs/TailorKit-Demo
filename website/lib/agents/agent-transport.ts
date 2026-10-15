import { asyncIteratorToUnproxiedDataStream } from "@orpc/client";
import type { ChatTransport } from "ai";
import type { CrmAgentMessage } from "./crm-agent";
import { agentRequest } from "./agent-request";
import { rpc } from "../orpc";

export function createAgentTransport(chat: typeof rpc.agent.chat): ChatTransport<CrmAgentMessage> {
  return {
    async sendMessages({ messages, body, abortSignal }) {
      const input = agentRequest.parse({ ...body, messages });
      return asyncIteratorToUnproxiedDataStream(await chat(input, { signal: abortSignal }));
    },
    async reconnectToStream() {
      return null;
    },
  };
}

export const agentTransport = createAgentTransport(rpc.agent.chat);
