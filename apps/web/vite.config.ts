import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { readFileSync } from "node:fs";

const rootDir = import.meta.dirname;

// Same source of truth the API reads (see apps/api/src/system/config.ts), so a
// build and the server it talks to can only disagree when one of them is a
// deploy behind — which is exactly the signal the stale-tab check looks for.
// Baked in at build time, so no VITE_APP_VERSION needs setting on the host.
const appVersion = (
  JSON.parse(
    readFileSync(path.resolve(rootDir, "../../package.json"), "utf8"),
  ) as { version?: string }
).version;
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  define: {
    // An explicit VITE_APP_VERSION still wins (CI can stamp a prerelease);
    // otherwise every build carries the package.json version.
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      process.env.VITE_APP_VERSION || appVersion,
    ),
  },
  envDir: path.resolve(rootDir, "../../"),
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://127.0.0.1:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
