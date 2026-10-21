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

const MIN_STEP_DISPLAY_MS = 250;
const COMPLETION_DISPLAY_MS = 250;
const WELCOME_FADE_DURATION_MS = 600;
const ENTER_FADE_DURATION_MS = 200;

const delay = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));
async function finishStep(startedAt: number) {
  await delay(Math.max(0, MIN_STEP_DISPLAY_MS - (performance.now() - startedAt)));
}

export function DemoSetup() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [welcome, setWelcome] = useState(false);
  const [entering, setEntering] = useState(false);
  const running = useRef(false);
  const router = useRouter();
  const { mutateAsync: provision } = useMutation(orpc.workspace.provision.mutationOptions());
  const { mutateAsync: installApps } = useMutation(orpc.workspace.installApps.mutationOptions());
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
        const appsStartedAt = performance.now();
        await installApps();
        await finishStep(appsStartedAt);
        setStep(3);
        await delay(COMPLETION_DISPLAY_MS);
        setStep(4);
        await delay(WELCOME_FADE_DURATION_MS);
        setWelcome(true);
        setStep(5);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Setup could not finish. Please try again.");
        running.current = false;
      }
    }
    void setup();
  }, [attempt, provision, installApps]);

  async function enterDemo() {
    if (entering) return;
    setEntering(true);
    await delay(ENTER_FADE_DURATION_MS);
    router.refresh();
  }

  return (
    <main
      className={cn(
        "flex min-h-svh items-center justify-center p-6 transition-opacity motion-reduce:transition-none",
        entering ? "duration-200" : "duration-600",
        (step === 4 || entering) && "opacity-0",
        welcome && !entering && "animate-in fade-in motion-reduce:animate-none",
      )}
    >
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="flex items-center justify-center gap-2">
          <Image
            src="/brand/patchsmith-mark-light.svg"
            alt=""
            width={24}
            height={24}
            className="shrink-0 dark:hidden"
          />
          <Image
            src="/brand/patchsmith-mark-dark.svg"
            alt=""
            width={24}
            height={24}
            className="hidden shrink-0 dark:block"
          />
          <span className="text-xl font-semibold tracking-tight">Patchsmith</span>
        </div>
        {welcome ? (
          <section
            aria-labelledby="demo-welcome-title"
            className="flex flex-col items-center gap-5 text-center"
          >
            <div className="flex flex-col gap-2">
              <h1 id="demo-welcome-title" className="text-2xl font-semibold tracking-tight">
                Welcome to Patchsmith demo app
              </h1>
              <p className="text-sm text-muted-foreground">
                This demo CRM lets you try Patchsmith: explore preinstalled apps, then ask the agent
                to build a new feature.
              </p>
            </div>
            <Button autoFocus size="lg" disabled={entering} onClick={() => void enterDemo()}>
              Enter demo
            </Button>
          </section>
        ) : (
          <Card>
            <CardHeader className="items-center text-center">
              <CardTitle>Setting up your demo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Progress
                value={step >= 3 ? 100 : step === 2 ? 75 : step === 1 ? 40 : 10}
                aria-label="Workspace setup progress"
              />
              <div role="status" aria-live="polite" className="flex flex-col gap-4">
                {[
                  "Create your anonymous account",
                  "Prepare your contacts, deals, and tasks",
                  "Install Messages and Doom",
                ].map((label, i) => (
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
                ))}
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
        )}
      </div>
    </main>
  );
}
