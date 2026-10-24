import stripeConfig from "../../apps/stripe/patchsmith.config";

type InstallApp = typeof import("./patchsmith-server").patchsmith.experimental.installApp;
type InstallOptions = { appId?: string; installApp?: InstallApp };

export async function installStripe(workspaceId: string, options: InstallOptions = {}) {
  const appId = options.appId ?? stripeConfig.appId;
  if (!appId?.trim())
    throw new Error(
      "Publish apps/stripe first and save its appId in apps/stripe/patchsmith.config.ts.",
    );
  const installApp =
    options.installApp ?? (await import("./patchsmith-server")).patchsmith.experimental.installApp;
  const installed = await installApp({
    appId,
    scope: { name: "workspace", value: { workspaceId } },
  });
  return installed.id;
}
