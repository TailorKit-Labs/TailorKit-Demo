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
  hasDoom,
  docked,
  onUseExample,
}: {
  ready: boolean;
  hasMessages: boolean;
  hasDoom: boolean;
  docked: boolean;
  onUseExample: () => void;
}) {
  const { step, setStep, dismiss } = useDemoIntro();
  const pathname = usePathname();
  const onContact = pathname.startsWith("/contacts/");
  const [loadFailed, setLoadFailed] = useState(false);
  const finish = useEffectEvent(dismiss);
  const next = useEffectEvent(() => {
    if (step === "messages") setStep("doom");
    else if (step === "agent") {
      dismiss();
      onUseExample();
    } else setStep("agent");
  });

  useEffect(() => {
    if (!ready || !step) return;
    let cancelled = false;
    let tour: Driver | undefined;

    const content = {
      messages: {
        element: hasMessages ? '[data-demo="messages-panel"]' : '[data-demo="apps-tabs"]',
        title: "Try Messages",
        description: !hasMessages
          ? "Patchsmith apps live beside the agent; Messages is unavailable right now."
          : onContact
            ? "Messages uses your CRM data to follow the contact you’re viewing."
            : "Open a conversation to see how a Patchsmith app connects to your CRM contacts.",
        progress: "1 of 3",
      },
      doom: {
        element: hasDoom ? '[data-demo="app-page-surface"]' : '[data-demo="apps-tabs"]',
        title: "Even Doom can live here",
        description: hasDoom
          ? "Doom fills a page, but apps can also live in side panels or add top-bar actions."
          : "Doom is unavailable, but apps can fill pages, sit in side panels, or add top-bar actions.",
        progress: "2 of 3",
      },
      agent: {
        element: '[data-demo="agent-composer"]',
        title: "Build a useful shortcut",
        description:
          "Click Next to ask the agent to build a Quick follow-up button for saving CRM tasks.",
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
          showButtons: ["next"],
          showProgress: true,
          progressText: content.progress,
          doneBtnText: "Next",
          // Arrow keys inside Messages or the composer belong to those controls.
          allowKeyboardControl: false,
          onDoneClick: () => next(),
          onDestroyed: (_element, _step, { reason }) => {
            if (!cancelled && reason !== "api") finish();
          },
          onPopoverRender: ({ nextButton }) => {
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
  }, [ready, step, hasMessages, hasDoom, docked, onContact]);

  return loadFailed && step ? (
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
