import { expect, test } from "vite-plus/test";
import type { Identity } from "patchsmith/server";
import pageRouter from "./page.fn";

test("panel links use the readable Doom page in every workspace", () => {
  for (const installationId of ["installation-a", "installation-b"]) {
    const identity: Identity = {
      appId: "shared-doom-source",
      installationId,
      deploymentId: "published-doom",
      projectId: "demo",
      subjectId: "visitor",
      toolUrl: "https://demo.patchsmith.io/api/patchsmith",
      scope: { name: "workspace", value: { workspaceId: `workspace-${installationId}` } },
      expiresAt: Date.now() + 60_000,
    };
    const page = pageRouter.get.handler({
      args: {},
      identity,
      get db(): never {
        throw new Error("Opening the game should not need database access.");
      },
    });
    expect(page).toEqual({ href: "/apps/doom/doom" });
  }
});
