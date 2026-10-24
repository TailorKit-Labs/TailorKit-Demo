import type { PatchsmithConfig } from "patchsmith/app/config";

export default {
  appId: "7206608c-42ec-4877-a824-84f2a20fc547",
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
