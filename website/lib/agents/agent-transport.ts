import { asyncIteratorToUnproxiedDataStream } from "@orpc/client";
import type { ChatTransport } from "ai";
import type { CrmAgentMessage } from "./crm-agent";
import { agentRequest } from "./agent-request";
import { rpc } from "../orpc";

export function createAgentTransport(chat: typeof rpc.agent.chat): ChatTransport<CrmAgentMessage> {
  return {
    async sendMessages({ messages, body, abortSignal }) {
      // History, including large app-build results, already lives on the server.
      const input = agentRequest.parse({ ...body, messages: messages.slice(-1) });
      return asyncIteratorToUnproxiedDataStream(await chat(input, { signal: abortSignal }));
    },
    async reconnectToStream() {
      return null;
    },
  };
}

export const agentTransport = createAgentTransport(rpc.agent.chat);
