import { initBotId } from "botid/client/core";
import { AGENT_RPC_PATH, AGENT_BOT_CHECK_LEVEL } from "./lib/agents/agent-protection";
import { SETUP_BOT_CHECK_LEVEL, SETUP_PROTECTED_PATHS } from "./lib/setup-protection";

initBotId({
  protect: [
    ...SETUP_PROTECTED_PATHS.map(
      (path) =>
        ({
          path,
          method: "POST",
          advancedOptions: { checkLevel: SETUP_BOT_CHECK_LEVEL },
        }) as const,
    ),
    {
      path: AGENT_RPC_PATH,
      method: "POST",
      advancedOptions: { checkLevel: AGENT_BOT_CHECK_LEVEL },
    },
  ],
});
