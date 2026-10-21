import { createTools } from "patchsmith/ai-sdk";
import { patchsmith } from "../patchsmith-server";

export function createPatchsmithTools(tenant: { id: string }, subjectId: string) {
  if (!process.env.PATCHSMITH_PROJECT_KEY) return undefined;
  const { listApps, createApp, editApp } = createTools(patchsmith, {
    subjectId,
    scopes: { workspace: { workspaceId: tenant.id } },
  });
  // Preserve the tool names used by existing chats.
  return {
    patchsmith_list_apps: listApps,
    patchsmith_create_app: createApp,
    patchsmith_edit_app: editApp,
  };
}
