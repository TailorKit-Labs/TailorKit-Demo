import doomConfig from "../../apps/doom/patchsmith.config";

type InstallApp = typeof import("./patchsmith-server").patchsmith.experimental.installApp;
type InstallOptions = { appId?: string; installApp?: InstallApp };

export async function installDoom(workspaceId: string, options: InstallOptions = {}) {
  const appId = options.appId ?? doomConfig.appId;
  if (!appId?.trim())
    throw new Error("Set appId in apps/doom/patchsmith.config.ts to the published Doom app ID.");
  const installApp =
    options.installApp ?? (await import("./patchsmith-server")).patchsmith.experimental.installApp;
  const installed = await installApp({
    appId,
    scope: { name: "workspace", value: { workspaceId } },
  });
  return installed.id;
}
