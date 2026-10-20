"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, BlocksIcon, MessageSquareIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";

export const FEATURE_PROMPT =
  "Build a follow-up planner in the apps panel using my contacts and tasks. Let me mark tasks complete and open the related contact.";

export type IntroStep = "welcome" | "apps" | "messages" | "contact" | "agent" | null;

const DemoIntroContext = createContext<{
  step: IntroStep;
  setStep: (step: IntroStep) => void;
  dismiss: () => void;
  replay: () => void;
} | null>(null);

export function useDemoIntro() {
  const intro = useContext(DemoIntroContext);
  if (!intro) throw new Error("Demo introduction requires DemoIntroProvider");
  return intro;
}

export function DemoIntroProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const [step, setStep] = useState<IntroStep>(null);
  const router = useRouter();
  const storageKey = `tailorkit:demo-intro:v1:${workspaceId}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) !== "dismissed") setStep("welcome");
    } catch {
      // The introduction still works when browser storage is unavailable.
      setStep("welcome");
    }
  }, [storageKey]);

  function dismiss() {
    setStep(null);
    try {
      localStorage.setItem(storageKey, "dismissed");
    } catch {
      // Dismiss for this visit even if the browser cannot remember it.
    }
  }

  return (
    <DemoIntroContext.Provider value={{ step, setStep, dismiss, replay: () => setStep("welcome") }}>
      {children}
      <Dialog
        open={step === "welcome"}
        onOpenChange={(open) => {
          if (!open) dismiss();
        }}
      >
        <DialogPopup finalFocus={false}>
          <DialogHeader>
            <span className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <BlocksIcon className="size-4" aria-hidden="true" />
              The TailorKit demo
            </span>
            <DialogTitle>Make this app work your way</DialogTitle>
            <DialogDescription className="leading-relaxed">
              TailorKit lets your users ask an AI agent for new features and use them directly
              inside your product.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-5">
              <p className="text-sm leading-relaxed">
                This is Forma, a sample CRM. Try an app we’ve installed, then ask the agent to build
                something of your own.
              </p>
              <div className="flex items-start gap-3">
                <MessageSquareIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">Start with Messages</p>
                  <p className="text-muted-foreground">See an app work with your CRM contacts.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <SparklesIcon
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">Ask for what’s missing</p>
                  <p className="text-muted-foreground">
                    Build a feature, try it, and ask for changes.
                  </p>
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  How would this work in my product?
                </summary>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  You choose which data, actions, and places in your interface TailorKit can use.
                  The agent builds features with those building blocks and your app’s components.
                  Features can appear in a panel, as full pages, or as actions in the top bar.
                </p>
              </details>
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button variant="ghost" onClick={dismiss}>
              Explore on my own
            </Button>
            <Button
              onClick={() => {
                router.push("/");
                setStep("apps");
              }}
            >
              Try Messages
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </DemoIntroContext.Provider>
  );
}
