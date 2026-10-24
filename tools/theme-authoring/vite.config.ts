import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  publicDir: false,
  assetsInclude: ["**/*.rsrc", "**/*.sit"],
  server: {
    port: 5174,
    fs: { allow: [resolve(import.meta.dirname, "../..")] },
  },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
});
