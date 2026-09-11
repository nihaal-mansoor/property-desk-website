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
 * and per-email rate limits, parameterised insert. (§4.4)
 *
 * WHY THE ADAPTER BELOW EXISTS. This was written as `(Request) => Response`, on
 * the assumption that Vercel's Node runtime accepts a web-standard handler. It
 * does not here: it calls the default export with Node's `(req, res)`. The two
 * failures that produced were not obviously related, which is what made it hard
 * to see:
 *
 *   GET  hung with no reply — `request.method` happens to work on a Node
 *        IncomingMessage, so the 405 was produced correctly, and then returned
 *        as a Response object that nothing ever sent. The platform waited for
 *        `res.end()` until it gave up.
 *   POST failed in half a second — `request.headers.get(...)` is not a function
 *        on a Node request, so the origin check threw and the throw escaped as
 *        FUNCTION_INVOCATION_FAILED.
 *
 * So the export now accepts either calling convention and adapts. Detecting it
 * at runtime rather than assuming one is deliberate: the shape of the platform
 * is the thing that cannot be checked from here, and this stops being a guess.
 */
import { handleLead, type HandlerResult } from "@uaeprop/site-kit/leads";

/**
 * Must match site.config.ts. Declared here rather than imported because a
 * Vercel Function should depend on nothing outside api/ and node_modules;
 * scripts/check-api-config.mjs asserts the two agree and the build runs it,
 * so the copy cannot drift silently. (§6.1)
 */
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

const OPTIONS = {
  /* No Cloudflare Turnstile on this site. The honeypot, the minimum time to
     submit and the per-IP and per-email rate limits still apply; only the
     interactive challenge is gone. Stated here rather than left to a missing
     secret, because the check fails closed and a silent opt-out would reject
     every genuine enquiry. */
  turnstile: false,
} as const;

/** Minimal shape of Node's IncomingMessage that this file touches. */
interface NodeReq {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: string, cb: (chunk?: unknown) => void): void;
}
/** Minimal shape of Node's ServerResponse that this file touches. */
interface NodeRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function readBody(req: NodeReq): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c as Buffer)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Node request -> web Request, so site-kit sees one shape whatever we are given. */
async function toWebRequest(req: NodeReq): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const host = headers.get("host") ?? config.domain;
  const method = (req.method ?? "GET").toUpperCase();
  /* A body is read only where one is allowed; GET and HEAD must not carry one
     and Request rejects it outright. */
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
  return new Request(`https://${host}${req.url ?? "/api/lead"}`, { method, headers, body });
}

function jsonHeaders(result: HandlerResult): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    // An enquiry response is never cacheable and never shared.
    "cache-control": "no-store",
    ...(result.headers ?? {}),
  };
}

export default async function handler(a: Request | NodeReq, b?: NodeRes): Promise<Response | void> {
  /* Web-standard invocation: a real Request in, a Response back. */
  if (typeof Request !== "undefined" && a instanceof Request) {
    const result = await handleLead(a, config, OPTIONS);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: jsonHeaders(result),
    });
  }

  /* Node invocation. Nothing may throw past this point: an escaped throw here
     is a blank 500 with no body, which is how this failed silently before. */
  const res = b as NodeRes;
  try {
    const result = await handleLead(await toWebRequest(a as NodeReq), config, OPTIONS);
    res.statusCode = result.status;
    for (const [k, v] of Object.entries(jsonHeaders(result))) res.setHeader(k, v);
    res.end(JSON.stringify(result.body));
  } catch (err) {
    console.error(`[lead] unhandled: ${err instanceof Error ? err.stack : String(err)}`);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    // Generic to the client, detailed in the log. (§4.4)
    res.end(JSON.stringify({ ok: false, message: "Something went wrong. Please try again." }));
  }
}
