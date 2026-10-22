import type { PatchsmithConfig } from "patchsmith/app/config";

export default {
  appId: "c829360e-41ac-4a91-b68b-ce38af081f61",
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
