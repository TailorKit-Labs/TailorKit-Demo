"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MIN_STEP_DISPLAY_MS = 1_000;
const COMPLETION_DISPLAY_MS = 1_000;
const FADE_DURATION_MS = 700;

const delay = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));
async function finishStep(startedAt: number) {
  await delay(Math.max(0, MIN_STEP_DISPLAY_MS - (performance.now() - startedAt)));
}

export function DemoSetup() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);
  const router = useRouter();
  const { mutateAsync: provision } = useMutation(orpc.workspace.provision.mutationOptions());
  useEffect(() => {
    if (running.current) return;
    running.current = true;
    async function setup() {
      try {
        setError("");
        setStep(0);
        const accountStartedAt = performance.now();
        const session = await authClient.getSession();
        if (session.error)
          throw new Error(session.error.message ?? "Unable to check your session.");
        if (!session.data) {
          const result = await authClient.signIn.anonymous();
          if (result.error)
            throw new Error(result.error.message ?? "Unable to create your account.");
        }
        await finishStep(accountStartedAt);
        setStep(1);
        const workspaceStartedAt = performance.now();
        await provision();
        await finishStep(workspaceStartedAt);
        setStep(2);
        // Keep both steps readable and show completion before the fade: at least 3 seconds total.
        await delay(COMPLETION_DISPLAY_MS);
        setStep(3);
        await delay(FADE_DURATION_MS);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setup could not finish. Please try again.");
        running.current = false;
      }
    }
    void setup();
  }, [attempt, router, provision]);
  return (
    <main
      className={cn(
        "flex min-h-svh items-center justify-center p-6 transition-all duration-700 motion-reduce:transition-none",
        step === 3 && "opacity-0 scale-95",
      )}
    >
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="flex items-center justify-center gap-2">
          <Image
            src="/brand/tailorkit-mark-light.svg"
            alt=""
            width={24}
            height={24}
            className="shrink-0 dark:hidden"
          />
          <Image
            src="/brand/tailorkit-mark-dark.svg"
            alt=""
            width={24}
            height={24}
            className="hidden shrink-0 dark:block"
          />
          <span className="text-xl font-semibold tracking-tight">TailorKit</span>
        </div>
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>Setting up your demo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Progress
              value={step >= 2 ? 100 : step === 1 ? 55 : 15}
              aria-label="Workspace setup progress"
            />
            <div role="status" aria-live="polite" className="flex flex-col gap-4">
              {["Create your anonymous account", "Prepare your contacts, deals, and tasks"].map(
                (label, i) => (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center gap-3 text-sm",
                      step < i && "text-muted-foreground",
                    )}
                  >
                    {step > i ? (
                      <CheckIcon className="size-4 shrink-0" />
                    ) : step === i && !error ? (
                      <Spinner className="size-4 shrink-0" />
                    ) : (
                      <span className="size-4 shrink-0 rounded-full border" />
                    )}
                    {label}
                  </div>
                ),
              )}
            </div>
            {error ? (
              <>
                <Alert variant="error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
