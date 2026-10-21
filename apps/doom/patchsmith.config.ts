import type { PatchsmithConfig } from "patchsmith/app/config";

export default {
  appId: "18a932b9-f31b-4701-be62-41d6f3dfa639",
  name: "Doom",
  slug: "doom",
  description: "Play Doom shareware in a full-page canvas, powered by doomgeneric.",
  host: "https://demo.patchsmith.io/api/patchsmith",
  logos: {
    light: "logo-light.svg",
    dark: "logo-dark.svg",
  },
  server: { entry: "src/server.ts" },
} satisfies PatchsmithConfig;
