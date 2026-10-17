import messagesConfig from "../../apps/messages/tailorkit.config";

type InstallApp = typeof import("./tailorkit-server").tailorKit.experimental.installApp;
type InstallOptions = { appId?: string; installApp?: InstallApp };

// Provisioning supplies a session-derived workspace ID under its database lock.
// The shared source app is published separately with the TailorKit CLI.
export async function installMessages(workspaceId: string, options: InstallOptions = {}) {
  const appId = options.appId ?? messagesConfig.appId;
  if (!appId?.trim())
    throw new Error(
      "Set appId in apps/messages/tailorkit.config.ts to the deployed Messages app ID.",
    );

  // Load the host lazily: its tools also import the provisioning router.
  const installApp =
    options.installApp ?? (await import("./tailorkit-server")).tailorKit.experimental.installApp;
  const installed = await installApp({
    appId,
    scope: { name: "workspace", value: { workspaceId } },
  });
  return installed.id;
}
