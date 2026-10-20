import { defineConfig, lazyPlugins } from "vite-plus";
import { patchsmith } from "patchsmith/vite";

export default defineConfig({
  plugins: lazyPlugins(() => [patchsmith()]),
  lint: {
    ignorePatterns: ["src/patchsmith.gen.ts", ".patchsmith/**"],
  },
  fmt: {
    ignorePatterns: ["src/patchsmith.gen.ts", ".patchsmith/**"],
  },
});
