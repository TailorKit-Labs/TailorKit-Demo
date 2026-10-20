// Browser-safe configuration shared with server verification.
export const SETUP_BOT_CHECK_LEVEL = "basic";
export const SETUP_PROTECTED_PATHS = [
  "/api/auth/sign-in/anonymous",
  "/rpc/workspace/provision",
  "/rpc/workspace/installApps",
] as const;
