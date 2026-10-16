import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "apps/messages/src/tailorkit.gen.ts",
      "apps/messages/.tailorkit/**",
      ".agents/**",
      "website/.agents/**",
      ".vite-hooks/**",
      ".zed/**",
      "website/AGENTS.md",
      "website/CLAUDE.md",
      // Keep registry components and their helpers exactly as supplied upstream.
      "website/components/ui/**",
      "website/hooks/use-media-query.ts",
      "website/lib/segmented-control.ts",
    ],
  },
  lint: {
    ignorePatterns: [
      ".agents/**",
      "website/.next/**",
      "apps/messages/src/tailorkit.gen.ts",
      "apps/messages/.tailorkit/**",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
