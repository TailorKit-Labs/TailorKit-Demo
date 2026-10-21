"use client";

import { patchsmithClient } from "@/lib/patchsmith-client";

const app = {
  id: "doom-verification",
  name: "Doom",
  clientPath: "/doom-verification/client",
  views: [{ slot: "page", path: "/", instances: true as const }],
};

// Exercise the actual SDK sandbox and canvas without a platform installation.
export function DoomVerification() {
  return (
    <patchsmithClient.Provider apps={[app]}>
      <main className="h-dvh p-6 [&>[data-patchsmith-view]]:h-full [&_canvas]:!h-full [&_canvas]:!w-full [&_canvas]:object-contain [&_canvas]:[image-rendering:pixelated]">
        <patchsmithClient.RenderSlot.Controlled
          app={app}
          slot="page"
          view="/"
          status="ready"
          context={{
            workspace: { id: "canvas-verification", name: "Canvas verification" },
            page: "/",
          }}
          instance={{ key: "doom", metadata: { label: "Doom" }, data: {} }}
        />
      </main>
    </patchsmithClient.Provider>
  );
}
