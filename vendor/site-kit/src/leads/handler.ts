import type { SiteConfig } from "../config/types.ts";
import { CONSENT_TEXT, CONSENT_VERSION } from "../legal/index.ts";
import { insertLead } from "./db.ts";
import { notifyByEmail } from "./notify.ts";
import { checkRateLimits } from "./ratelimit.ts";
import { MIN_SUBMIT_MS, fieldErrors, leadSchema } from "./schema.ts";
import { verifyTurnstile } from "./turnstile.ts";

/**
 * The single server entry point for every form in the portfolio. (CLAUDE.md §4.4)
 *
 * Defence order matters: cheap local checks run before anything that costs a
 * network round trip or a database write.
 *
 *   1. Method and origin
 *   2. Schema (strict — unknown keys rejected)
 *   3. Honeypot and time-trap
 *   4. Turnstile (network, fails closed)
 *   5. Rate limits (database)
 *   6. Persist, then notify
 *
 * Client-facing errors are deliberately generic. Detail goes to the server log,
 * keyed by lead id — never PII. (§4.4)
 */

export interface HandlerResult {
  readonly status: number;
  readonly body: {
    readonly ok: boolean;
    readonly message: string;
    readonly errors?: Record<string, string>;
  };
  readonly headers?: Record<string, string>;
}

const GENERIC_ERROR = "Something went wrong. Please try again, or message us on WhatsApp.";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || null;
}

/** Same-origin check. A cross-origin POST is rejected outright. (§4.4) */
function originAllowed(request: Request, config: SiteConfig): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin form posts may omit Origin
  try {
    const host = new URL(origin).host;
    return (
      host === config.domain ||
      host === `www.${config.domain}` ||
      host.endsWith(".vercel.app") // preview deployments
    );
  } catch {
    return false;
  }
}

export async function handleLead(
  request: Request,
  config: SiteConfig,
): Promise<HandlerResult> {
  if (request.method !== "POST") {
    return {
      status: 405,
      body: { ok: false, message: "Method not allowed." },
      headers: { allow: "POST" },
    };
  }

  if (!originAllowed(request, config)) {
    return { status: 403, body: { ok: false, message: GENERIC_ERROR } };
  }

  let raw: unknown;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      raw = await request.json();
    } else {
      raw = Object.fromEntries(await request.formData());
    }
  } catch {
    return { status: 400, body: { ok: false, message: GENERIC_ERROR } };
  }

  // Checkboxes arrive as "on" from a plain form post; coerce before validating.
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r["consent"] === "on" || r["consent"] === "true") r["consent"] = true;
  }

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 422,
      body: {
        ok: false,
        message: "Please check the highlighted fields.",
        errors: fieldErrors(parsed.error),
      },
    };
  }
  const lead = parsed.data;

  // Honeypot: a real user never fills a field they cannot see.
  if (lead.company) {
    // Answer as if accepted — do not teach the bot what tripped it.
    return { status: 200, body: { ok: true, message: "Thanks — we'll be in touch." } };
  }

  // Time-trap: a human cannot complete this form in under two seconds.
  if (lead.renderedAt && Date.now() - lead.renderedAt < MIN_SUBMIT_MS) {
    return { status: 200, body: { ok: true, message: "Thanks — we'll be in touch." } };
  }

  const ip = clientIp(request);

  const turnstile = await verifyTurnstile(
    lead.turnstileToken,
    ip ?? undefined,
    process.env["TURNSTILE_SECRET_KEY"],
  );
  if (!turnstile.ok) {
    console.warn(`[lead] turnstile rejected: ${turnstile.reason}`);
    return {
      status: 400,
      body: { ok: false, message: "Verification failed. Please reload and try again." },
    };
  }

  const limit = await checkRateLimits(ip, lead.email);
  if (!limit.allowed) {
    return {
      status: 429,
      body: { ok: false, message: "Too many enquiries. Please try again later." },
      headers: { "retry-after": String(limit.retryAfterSeconds) },
    };
  }

  let leadId: number;
  try {
    leadId = await insertLead({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      message: lead.message ?? null,
      sourceDomain: config.domain,
      sourcePage: lead.sourcePage ?? "/",
      sourceTopic: config.topic,
      consentText: CONSENT_TEXT,
      consentVersion: CONSENT_VERSION,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });
  } catch (err) {
    console.error("[lead] persist failed:", err instanceof Error ? err.message : err);
    return { status: 500, body: { ok: false, message: GENERIC_ERROR } };
  }

  // The lead is saved. A failed notification must not fail the request.
  const notified = await notifyByEmail(config, {
    leadId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    message: lead.message ?? null,
    sourcePage: lead.sourcePage ?? "/",
  });
  if (!notified.ok) {
    console.error(`[lead] #${leadId} saved but notify failed: ${notified.reason}`);
  }

  console.info(`[lead] #${leadId} accepted from ${config.domain}`);
  return {
    status: 200,
    body: { ok: true, message: "Thanks — we'll be in touch shortly." },
  };
}
