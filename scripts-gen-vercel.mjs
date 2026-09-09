// Generates vercel.json from site-kit's header builder so all 33 sites stay in step.
import { writeFileSync } from "node:fs";
import { vercelHeadersConfig } from "./vendor/site-kit/src/security/headers.ts";

const config = {
  $schema: "https://openapi.vercel.sh/vercel.json",
  ...vercelHeadersConfig({
    analytics: true,
    // The enquiry form's bot defence. Turnstile renders in an iframe, so this
    // also flips frame-src from 'none' to the Cloudflare origin; without it the
    // widget is blocked and never appears, and the form can never be submitted.
    turnstile: true,
    clarity: false,
    useNonce: false,
    // The map's tiles and style JSON. Named explicitly rather than a wildcard,
    // so only this host can serve map data. MapLibre decodes tiles in a worker
    // it compiles to a blob, which default-src 'self' would otherwise block.
    connectSrc: ["https://tiles.openfreemap.org"],
    imgSrc: ["https://tiles.openfreemap.org", "blob:"],
    workerSrc: ["blob:"],
  }),
  cleanUrls: true,
  trailingSlash: false,
};
writeFileSync("vercel.json", JSON.stringify(config, null, 2) + "\n");
console.log("vercel.json written");
