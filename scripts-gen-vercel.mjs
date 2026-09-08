// Generates vercel.json from site-kit's header builder so all 33 sites stay in step.
import { writeFileSync } from "node:fs";
import { vercelHeadersConfig } from "../site-kit/src/security/headers.ts";

const config = {
  $schema: "https://openapi.vercel.sh/vercel.json",
  ...vercelHeadersConfig({ analytics: true, turnstile: true, useNonce: false }),
  cleanUrls: true,
  trailingSlash: false,
};
writeFileSync("vercel.json", JSON.stringify(config, null, 2) + "\n");
console.log("vercel.json written");
