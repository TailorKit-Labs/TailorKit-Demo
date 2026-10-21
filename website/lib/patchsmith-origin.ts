type HostEnvironment = Record<string, string | undefined>;

export function patchsmithOrigin(env: HostEnvironment = process.env) {
  return env.VERCEL_ENV === "preview" && env.VERCEL_URL
    ? `https://${env.VERCEL_URL}`
    : (env.BETTER_AUTH_URL ??
        (env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000"));
}

export function patchsmithRequestOrigin(requestUrl: string, env: HostEnvironment = process.env) {
  const origin = new URL(requestUrl).origin;
  // Only the branch alias supplied by Vercel may select an alternative host.
  // Never trust an arbitrary Origin, Host, or forwarded header to issue tool URLs.
  if (
    env.VERCEL_ENV === "preview" &&
    env.VERCEL_BRANCH_URL &&
    origin === `https://${env.VERCEL_BRANCH_URL}`
  )
    return origin;
  return patchsmithOrigin(env);
}
