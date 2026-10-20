import { useState } from "preact/hooks";
import { defineView } from "patchsmith/client";
import { Button, tools } from "#patchsmith";

const view = defineView({ view: "/", component: MessageButton });

function MessageButton() {
  const { page } = view.useContext();
  const [opening, setOpening] = useState(false);
  const label = page.startsWith("/contacts/") ? "Chat" : "Messages";

  async function open() {
    setOpening(true);
    try {
      await tools.ui.openPanel();
    } catch {
      await tools.ui
        .notify({ title: `Couldn't open ${label}. Please try again.`, type: "error" })
        .catch(() => {});
    } finally {
      setOpening(false);
    }
  }

  if (page === "/contacts") return null;

  return (
    <Button
      label={label}
      variant="ghost"
      size="sm"
      disabled={opening}
      onClick={() => void open()}
    />
  );
}

export default view;
