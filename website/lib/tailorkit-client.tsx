"use client";

import { createClient, primitives } from "tailorkit/react";
import { contract } from "./tailorkit";

export const tailorKitClient = createClient({
  contract,
  baseUrl: new URL(
    "/api/tailorkit",
    typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
  ),
  components: primitives,
});

export const {
  Provider: TailorKitProvider,
  RenderSlot,
  useViews,
  useViewContext,
} = tailorKitClient;
