/**
 * Enquiry endpoint. A native Vercel Function, not an Astro Action.
 *
 * The site is `output: "static"` with no adapter (CLAUDE.md §2: the Astro Vercel
 * adapter ships a vulnerable path-to-regexp with no patched release), and Astro
 * Actions need a server. Vercel serves this alongside the static build, so the
 * pages stay fully prerendered and only this one route runs.
 *
 * Everything of consequence lives in site-kit: origin check, field allow-list,
 * length caps, E.164 normalisation, HTML rejection, honeypot, time-trap, per-IP
 * and per-email rate limits, parameterised insert. (§4.4) This file is the
 * adapter and nothing more.
 *
 * NOTE ON THE CONFIG BELOW. This used to `import site from "../site.config.ts"`,
 * which reaches outside the function root and carries an explicit .ts extension.
 * That is the shape that leaves Node with a specifier it cannot load at runtime,
 * and the deployed function answered every request, GET included, with
 * FUNCTION_INVOCATION_FAILED: a crash during module load, before any of this
 * code ran. The four values the lead path actually reads are declared here
 * instead, so the function depends on nothing outside api/ and node_modules.
 * They are asserted against site.config.ts by scripts/check-api-config.mjs,
 * which the build runs, so the duplication cannot drift silently. (§6.1)
 */
import { handleLead } from "@uaeprop/site-kit/leads";

/** Must match site.config.ts. Enforced by scripts/check-api-config.mjs. */
const config = {
  brand: "Property Desk",
  domain: "propertydeskdubai.com",
  tagline: "What Dubai property actually sold for.",
  topic: "Dubai community sale prices",
  contact: { whatsapp: "", email: process.env["LEAD_TO_EMAIL"] ?? "" },
  analytics: { ga4MeasurementId: "", clarityProjectId: "" },
  og: { image: "/og.png", imageAlt: "Property Desk community price map" },
  contentReviewedAt: "2026-09-09",
} as const;

/* Web-standard (Request -> Response) signature, which Vercel's Node runtime
   accepts. */
export default async function handler(request: Request): Promise<Response> {
  const result = await handleLead(request, config, {
    /* No Cloudflare Turnstile on this site. The honeypot, the minimum time to
       submit and the per-IP and per-email rate limits still apply; only the
       interactive challenge is gone. Stated here rather than left to a missing
       secret, because the check fails closed and a silent opt-out would reject
       every genuine enquiry. */
    turnstile: false,
  });
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // An enquiry response is never cacheable and never shared.
      "cache-control": "no-store",
      ...(result.headers ?? {}),
    },
  });
}
