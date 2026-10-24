import { defineView, useQuery } from "patchsmith/client";
import { useState } from "preact/hooks";
import { Alert, Button, Empty, Flex, api, tools } from "#patchsmith";

const view = defineView({ view: "/", component: DoomPanel });

function DoomPanel() {
  const page = useQuery(api.page.get, {});
  const [error, setError] = useState("");

  async function openGame() {
    if (!page.data) return;
    setError("");
    try {
      await tools.ui.navigate({ href: page.data.href });
    } catch {
      setError("Couldn't open Doom. Please try again.");
    }
  }

  return (
    <Flex direction="column" gap="4" height="full" justify="center">
      <Empty
        icon="gamepad"
        title="Yep, it runs DOOM."
        description="Play Doom right here in the app."
      >
        <Button label="Play Doom" size="sm" disabled={!page.data} onClick={openGame} />
      </Empty>
      {page.error || error ? (
        <Alert
          title="Could not open Doom"
          description={error || "Close and reopen this panel to try again."}
          variant="error"
        />
      ) : null}
    </Flex>
  );
}

export default view;
