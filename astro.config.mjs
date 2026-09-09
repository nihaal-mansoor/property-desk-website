import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import config from "./site.config.ts";

/**
 * Static output, no adapter. The Vercel adapter ships a vulnerable
 * path-to-regexp with no patched release (CLAUDE.md §2), and nothing here needs
 * a server: the calculator runs in the browser and every page is prerendered.
 */
export default defineConfig({
  site: `https://${config.domain}`,
  output: "static",
  integrations: [sitemap(), icon({ include: { lucide: ["*"] } })],
  vite: {
    plugins: [tailwind()],
    /* MapLibre ships its tile decoder as a separate worker module. Vite's dep
       pre-bundling rewrites the import but does not emit the worker, so in dev
       it 404s and the map loads its style and sprites and then renders nothing,
       with no error to explain why. Excluding it leaves the worker resolvable. */
    optimizeDeps: { exclude: ["maplibre-gl"] },
  },
  build: { inlineStylesheets: "never" },
});
