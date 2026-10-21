import type { PatchsmithConfig } from "patchsmith/app/config";

export default {
  appId: "bf718401-f7c4-45cb-96a5-3c7f3fd1356b",
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
