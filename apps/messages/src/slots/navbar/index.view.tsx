import { useState } from "preact/hooks";
import { defineView } from "patchsmith/client";
import { Button, tools } from "#patchsmith";

function MessageButton() {
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    try {
      await tools.ui.openPanel();
    } catch {
      await tools.ui
        .notify({ title: "Couldn't open Messages. Please try again.", type: "error" })
        .catch(() => {});
    } finally {
      setOpening(false);
    }
  }

  return (
    <Button
      label="Messages"
      variant="ghost"
      size="sm"
      disabled={opening}
      onClick={() => void open()}
    />
  );
}

export default defineView({ view: "/", component: MessageButton });
