/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// Dev-server equivalent of the security headers in public/_headers.
// Dev is more permissive (Vite/HMR needs inline scripts and eval); the
// production headers (public/_headers and the preview server below) are
// strict. See docs/architecture.md.
// COOP/COEP are deliberately not set yet: agent.md enables them only if
// multi-threaded WASM later requires it.
const devSecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/* Matches public/_headers exactly so `vite preview` and e2e tests run
 * under the same CSP as production. connect-src must be extended in
 * Phase 7 when model downloads get a pinned host. */
const prodSecurityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "VISTA — Private Photo Library",
        short_name: "VISTA",
        description: "A private photo library that runs locally in your browser.",
        theme_color: "#e9e7e3",
        background_color: "#e9e7e3",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ico}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    headers: devSecurityHeaders,
  },
  preview: {
    headers: prodSecurityHeaders,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/unit/**/*.test.*",
      "tests/integration/**/*.test.*",
      "tests/component/**/*.test.*",
    ],
    passWithNoTests: true,
  },
});
