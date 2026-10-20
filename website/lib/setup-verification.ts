import { checkBotId } from "botid/server";
import { SETUP_BOT_CHECK_LEVEL } from "./setup-protection";

// Both Better Auth and oRPC translate this failure into their native errors.
export async function verifyDemoSetup(): Promise<{
  code: "FORBIDDEN" | "SERVICE_UNAVAILABLE";
  message: string;
} | null> {
  try {
    const verification = await checkBotId({
      advancedOptions: { checkLevel: SETUP_BOT_CHECK_LEVEL },
      developmentOptions: {
        isDevelopment: process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1",
      },
    });
    if (verification.isBot === false) return null;
    if (verification.isBot === true)
      return {
        code: "FORBIDDEN",
        message: "This request could not be verified. Please use the app to set up your demo.",
      };
    throw new Error("BotID returned an invalid verification result.");
  } catch (error) {
    console.error("Demo setup bot verification failed:", error);
    return {
      code: "SERVICE_UNAVAILABLE",
      message: "Demo setup could not verify this request. Please try again.",
    };
  }
}
