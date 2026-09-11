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
  /* vercel.json sets trailingSlash:false, so Vercel 308s /method/ to /method.
     Astro's default emits the slashed form into the sitemap, which meant every
     non-homepage URL we submitted was a redirect: wasted crawl budget and a
     "Page with redirect" row in Search Console for each one. This makes the
     sitemap agree with the canonicals. */
  trailingSlash: "never",
  integrations: [sitemap(), icon({ include: { lucide: ["*"] } })],
  vite: {
    plugins: [tailwind()],
    /* MapLibre ships its tile decoder as a separate worker module. Vite's dep
       pre-bundling rewrites the import but does not emit the worker, so in dev
       it 404s and the map loads its style and sprites and then renders nothing,
       with no error to explain why. Excluding it leaves the worker resolvable. */
    optimizeDeps: { exclude: ["maplibre-gl"] },
    /* Astro inlines a small bundled <script> straight into the HTML, and the
       CSP has no 'unsafe-inline' and no nonce, so an inlined script is dead on
       arrival in production with nothing in the build to say so (CLAUDE.md
       §4.1). @vercel/analytics is small enough to trip this. Forcing the
       inline limit to zero keeps every script an external file under /_astro,
       which script-src 'self' allows. Nothing here was being inlined as a data
       URI before, so this costs no extra requests. */
    build: { assetsInlineLimit: 0 },
  },
  build: { inlineStylesheets: "never" },
});
