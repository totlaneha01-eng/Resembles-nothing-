import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The shop is served by the Express backend as static files (see src/index.js),
// with the API mounted under /api. In dev, proxy /api to the backend so the
// app can be run standalone with `npm run dev` against a local API server.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  build: {
    // Build straight into the backend's public/ folder, which src/index.js
    // already serves via express.static — same mechanism as the previous
    // static landing page, no Render build-command change required.
    outDir: "../public",
    emptyOutDir: true,
    // Keep the base64-embedded product images in one chunk instead of inlining
    // them repeatedly; the file is large (~2.4MB source) so raise the warning
    // threshold rather than fighting Vite about it.
    chunkSizeWarningLimit: 3000,
  },
});
