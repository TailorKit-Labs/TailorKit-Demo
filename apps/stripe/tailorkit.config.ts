import type { TailorKitConfig } from "tailorkit/app/config";

export default {
  name: "Stripe",
  slug: "stripe",
  host: "https://demo.tailorkit.dev/api/tailorkit",
  server: {},
  logos: { light: "logo.svg", dark: "logo.svg" },
} satisfies TailorKitConfig;
