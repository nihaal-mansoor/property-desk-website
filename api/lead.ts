/**
 * Enquiry endpoint. A native Vercel Function, not an Astro Action.
 *
 * The site is `output: "static"` with no adapter (CLAUDE.md §2: the Astro Vercel
 * adapter ships a vulnerable path-to-regexp with no patched release), and Astro
 * Actions need a server. Vercel serves this alongside the static build, so the
 * pages stay fully prerendered and only this one route runs.
 *
 * Everything of consequence lives in site-kit: origin check, field allow-list,
 * length caps, E.164 normalisation, HTML rejection, honeypot, time-trap,
 * server-side Turnstile, per-IP and per-email rate limits, parameterised insert.
 * (§4.4) This file is the adapter and nothing more.
 */
import { handleLead } from "@uaeprop/site-kit/leads";
import site from "../site.config.ts";

/** site-kit's SiteConfig. Only `domain` is read on this path, but the shape is
 *  the contract, so it is satisfied honestly rather than cast away. */
const config = {
  brand: site.brand,
  domain: site.domain,
  tagline: site.tagline,
  topic: site.topic,
  contact: { whatsapp: "", email: site.contactEmail },
  analytics: { ga4MeasurementId: site.gaMeasurementId, clarityProjectId: site.clarityProjectId },
  og: { image: site.og.image, imageAlt: `${site.brand} community price map` },
  contentReviewedAt: site.contentReviewedAt,
} as const;

/* Web-standard (Request -> Response) signature, which Vercel's Node runtime
   accepts. This is the one thing here that cannot be proven locally, so it is
   on the launch checklist to confirm against the first deploy. */
export default async function handler(request: Request): Promise<Response> {
  const result = await handleLead(request, config);
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
