"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "./orpc";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "tailorkit/react";
import { contract } from "./tailorkit";
import { tailorKitTheme } from "./tailorkit-theme";
import { tailorKitComponents } from "@/components/tailorkit-components";
import { toastManager } from "@/components/ui/toast";

type HostAction =
  | { type: "navigate"; href: string }
  | { type: "refresh" }
  | { type: "theme"; theme: "light" | "dark" | "system" };
const hostActionEvent = "tailorkit:host-action";
function dispatch(action: HostAction) {
  const detail = { action, handled: false };
  window.dispatchEvent(new CustomEvent(hostActionEvent, { detail }));
  if (!detail.handled) throw new Error("The workspace is not ready. Please try again.");
}

export const tailorKitClient = createClient({
  contract,
  theme: tailorKitTheme,
  baseUrl: new URL(
    "/api/tailorkit",
    typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
  ),
  components: tailorKitComponents,
  tools: {
    ui: {
      navigate: ({ input }) => dispatch({ type: "navigate", href: input.href }),
      refresh: () => dispatch({ type: "refresh" }),
      setTheme: ({ input }) => dispatch({ type: "theme", theme: input.theme }),
      notify: ({ input }) => {
        toastManager.add(input);
      },
    },
  },
});

export function TailorKitProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  useEffect(() => {
    function handle(event: Event) {
      const { detail } = event as CustomEvent<{ action: HostAction; handled: boolean }>;
      detail.handled = true;
      switch (detail.action.type) {
        case "navigate":
          router.push(detail.action.href);
          break;
        case "refresh":
          void queryClient.invalidateQueries({ queryKey: orpc.key() });
          break;
        case "theme":
          setTheme(detail.action.theme);
          break;
      }
    }
    window.addEventListener(hostActionEvent, handle);
    return () => window.removeEventListener(hostActionEvent, handle);
  }, [router, setTheme, queryClient]);
  return <tailorKitClient.Provider>{children}</tailorKitClient.Provider>;
}

export const { RenderSlot, useViews, useViewContext } = tailorKitClient;
