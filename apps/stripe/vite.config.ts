import { defineConfig, lazyPlugins } from "vite-plus";
import { tailorkit } from "tailorkit/vite";

export default defineConfig({
  plugins: lazyPlugins(() => [tailorkit()]),
  lint: {
    ignorePatterns: ["src/tailorkit.gen.ts", ".tailorkit/**"],
  },
  fmt: {
    ignorePatterns: ["src/tailorkit.gen.ts", ".tailorkit/**"],
  },
});
