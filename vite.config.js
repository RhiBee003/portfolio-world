import { defineConfig } from "vite";

// GitHub Pages project site uses /portfolio-world/; Render serves from the root.
const base = process.env.RENDER ? "/" : "/portfolio-world/";

export default defineConfig({
  base,
  root: ".",
  publicDir: "public",
  server: {
    port: 5174,
    open: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("pdfjs-dist")) return "pdf";
        },
      },
    },
  },
});
