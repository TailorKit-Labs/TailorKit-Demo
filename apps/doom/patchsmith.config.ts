import type { PatchsmithConfig } from "patchsmith/app/config";

export default {
  appId: "d943612a-f3d1-43da-9cc6-146d713bb2a8",
  name: "Doom",
  slug: "doom",
  description: "Play Doom shareware in a full-page canvas, powered by doomgeneric.",
  host: "https://demo.patchsmith.io/api/patchsmith",
  logos: {
    light: "logo-light.svg",
    dark: "logo-dark.svg",
  },
  server: {},
} satisfies PatchsmithConfig;
