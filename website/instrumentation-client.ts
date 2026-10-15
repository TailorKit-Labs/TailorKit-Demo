import { initBotId } from "botid/client/core";
import { AGENT_RPC_PATH, AGENT_BOT_CHECK_LEVEL } from "./lib/agents/agent-protection";

initBotId({
  protect: [
    {
      path: AGENT_RPC_PATH,
      method: "POST",
      advancedOptions: { checkLevel: AGENT_BOT_CHECK_LEVEL },
    },
  ],
});
