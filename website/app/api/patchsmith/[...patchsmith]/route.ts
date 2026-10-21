import { patchsmithForRequest } from "@/lib/patchsmith-server";
import { auth } from "@/lib/auth";
import { tenantForUser } from "@/routers/context";

async function handleRequest(request: Request) {
  const started = performance.now();
  let authenticationMs = 0;
  const response = await patchsmithForRequest(request).handler(request, {
    authenticate: async () => {
      const authenticationStarted = performance.now();
      try {
        // React.cache only deduplicates during server rendering. Read the session
        // once here so route handlers don't repeat the database authentication.
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return null;
        const tenant = await tenantForUser(session.user.id);
        return {
          subjectId: session.user.id,
          scopes: { workspace: { workspaceId: tenant.id } },
        };
      } catch {
        return null;
      } finally {
        authenticationMs += performance.now() - authenticationStarted;
      }
    },
  });
  const headers = new Headers(response.headers);
  headers.append(
    "server-timing",
    `workspace_auth;dur=${authenticationMs.toFixed(1)}, host;dur=${(performance.now() - started).toFixed(1)}`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const OPTIONS = handleRequest;
