/**
 * Copies MapLibre's dist into public/.
 *
 *   node scripts/vendor-maplibre.mjs
 *
 * The ESM build loads its tile decoder from a separate worker module, and
 * neither Vite's dev server nor its production build emits that file: the map
 * fetches its style and sprites, then renders nothing, with a 404 for
 * maplibre-gl-worker.mjs as the only clue.
 *
 * Serving the dist directly sidesteps the bundler: the browser resolves the
 * worker next to the module that asked for it, exactly as MapLibre expects.
 * Vendored rather than loaded from a CDN so there is no third party in the
 * critical path and nothing extra to allow in the policy.
 */
import { copyFileSync, readFileSync } from "node:fs";

const version = JSON.parse(readFileSync("node_modules/maplibre-gl/package.json", "utf8")).version;
/* All three, and the names must not change: maplibre-gl.mjs imports the shared
   chunk and spawns the worker by relative path, so they have to sit together. */
for (const name of [
  "maplibre-gl.mjs",
  "maplibre-gl-shared.mjs",
  "maplibre-gl-worker.mjs",
  "maplibre-gl.css",
]) {
  const from = `node_modules/maplibre-gl/dist/${name}`;
  const to = `public/vendor/${name}`;
  copyFileSync(from, to);
  console.log(`  ${to}  ${(readFileSync(to).length / 1024).toFixed(0)} KB`);
}
console.log(`vendored maplibre-gl ${version}`);
