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
    <Flex direction="column" gap="md" height="100%" justify="center">
      <Empty
        title="Yep, it runs DOOM."
        description="The real game, running in its own sandbox and brought right into this app by Patchsmith. Go on, play it."
      >
        <Button label="Play Doom" variant="link" disabled={!page.data} onClick={openGame} />
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
