"use server";
import { getCurrentSession } from "./workspace-session";
import { provisionForUser } from "./provision";

export type ActionResult = { success: true } | { success: false; error: string };
export async function provisionWorkspace(): Promise<ActionResult> {
  try {
    const session = await getCurrentSession();
    if (!session) throw new Error("Please create your demo account first.");
    await provisionForUser(session.user.id);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Workspace setup failed. Please try again.",
    };
  }
}
