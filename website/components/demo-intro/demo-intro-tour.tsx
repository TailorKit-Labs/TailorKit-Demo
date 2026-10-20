"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { usePathname } from "next/navigation";
import type { Driver } from "driver.js";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDemoIntro } from "./demo-intro-provider";

export function DemoIntroTour({
  ready,
  hasMessages,
  docked,
  onUseExample,
}: {
  ready: boolean;
  hasMessages: boolean;
  docked: boolean;
  onUseExample: () => void;
}) {
  const { step, setStep, dismiss } = useDemoIntro();
  const pathname = usePathname();
  const [loadFailed, setLoadFailed] = useState(false);
  const finish = useEffectEvent(dismiss);
  const next = useEffectEvent(() => {
    if (step === "apps" && hasMessages) setStep("messages");
    else if (step === "agent") {
      dismiss();
      onUseExample();
    } else setStep("agent");
  });

  // Messages navigates through the host, so no selectors inside its sandbox are needed.
  useEffect(() => {
    if (step === "messages" && pathname.startsWith("/contacts/")) setStep("contact");
  }, [pathname, step, setStep]);

  useEffect(() => {
    if (!ready || !step || step === "welcome") return;
    let cancelled = false;
    let tour: Driver | undefined;

    const content = {
      apps: {
        element: '[data-demo="apps-tabs"]',
        title: "Your apps live here",
        description: hasMessages
          ? "Messages is an installed TailorKit app. Apps add features alongside your workspace. Its top-bar button opens this same panel."
          : "Apps add features alongside your workspace. Messages is unavailable right now, but you can still explore the agent.",
        button: hasMessages ? "Try a conversation" : "Try the agent",
        progress: "1 of 3",
      },
      messages: {
        element: '[data-demo="messages-panel"]',
        title: "Open a conversation",
        description:
          "Choose a conversation in Messages. It opens that contact in the CRM and shows their messages here. Demo messages aren’t delivered.",
        button: "Try the agent",
        progress: "2 of 3",
      },
      contact: {
        element: '[data-demo="messages-panel"]',
        title: "Messages follows your work",
        description:
          "You’re on a contact’s CRM page, and Messages now shows their conversation. TailorKit apps can use the page’s context and work with your existing data.",
        button: "Build your own feature",
        progress: "2 of 3",
      },
      agent: {
        element: '[data-demo="agent-composer"]',
        title: "Ask for a feature",
        description:
          "Try building a follow-up planner with your contacts and tasks. Features can live in this panel, open as full pages, or add top-bar actions. You can ask for changes afterwards.",
        button: "Use example prompt",
        progress: "3 of 3",
      },
    }[step];

    void import("driver.js")
      .then(({ driver }) => {
        if (cancelled) return;
        setLoadFailed(false);
        tour = driver({
          animate: false,
          overlayOpacity: 0.35,
          overlayClickBehavior: "close",
          popoverClass: "demo-tour-popover",
          stagePadding: 5,
          stageRadius: 12,
          showButtons: ["next", "close"],
          showProgress: true,
          progressText: content.progress,
          doneBtnText: content.button,
          closeBtnLabel: "Skip introduction",
          // Arrow keys inside Messages or the composer belong to those controls.
          allowKeyboardControl: false,
          onDoneClick: () => next(),
          onDestroyed: (_element, _step, { reason }) => {
            if (!cancelled && reason !== "api") finish();
          },
          onPopoverRender: ({ closeButton, nextButton }) => {
            closeButton.textContent = "Skip";
            nextButton.focus();
          },
          steps: [
            {
              element: content.element,
              waitForElement: 3000,
              popover: {
                title: content.title,
                description: content.description,
                side: docked ? "left" : "top",
                align: "start",
              },
            },
          ],
        });
        tour.drive();
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
    }
    document.addEventListener("keydown", onEscape, true);
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onEscape, true);
      tour?.destroy();
    };
  }, [ready, step, hasMessages, docked]);

  return loadFailed && step && step !== "welcome" ? (
    <Alert className="m-2 w-auto">
      <AlertDescription>The introduction couldn’t load. You can keep exploring.</AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
      </AlertAction>
    </Alert>
  ) : null;
}
