// Generates vercel.json from site-kit's header builder so all 33 sites stay in step.
import { writeFileSync } from "node:fs";
import { vercelHeadersConfig } from "../site-kit/src/security/headers.ts";

const config = {
  $schema: "https://openapi.vercel.sh/vercel.json",
  ...vercelHeadersConfig({
    analytics: true,
    // Neither is used on this site.
    turnstile: false,
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
