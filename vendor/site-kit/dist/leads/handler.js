import { CONSENT_TEXT, CONSENT_VERSION } from "../legal/index.js";
import { insertLead } from "./db.js";
import { notifyByEmail } from "./notify.js";
import { checkRateLimits } from "./ratelimit.js";
import { MIN_SUBMIT_MS, fieldErrors, leadSchema } from "./schema.js";
import { verifyTurnstile } from "./turnstile.js";
const GENERIC_ERROR = "Something went wrong. Please try again, or message us on WhatsApp.";
function clientIp(request) {
    const forwarded = request.headers.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    return first || request.headers.get("x-real-ip") || null;
}
/** Same-origin check. A cross-origin POST is rejected outright. (§4.4) */
function originAllowed(request, config) {
    const origin = request.headers.get("origin");
    if (!origin)
        return true; // same-origin form posts may omit Origin
    try {
        const host = new URL(origin).host;
        return (host === config.domain ||
            host === `www.${config.domain}` ||
            host.endsWith(".vercel.app") // preview deployments
        );
    }
    catch {
        return false;
    }
}
export async function handleLead(request, config, options) {
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
    let raw;
    try {
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            raw = await request.json();
        }
        else {
            raw = Object.fromEntries(await request.formData());
        }
    }
    catch {
        return { status: 400, body: { ok: false, message: GENERIC_ERROR } };
    }
    // Checkboxes arrive as "on" from a plain form post; coerce before validating.
    if (raw && typeof raw === "object") {
        const r = raw;
        if (r["consent"] === "on" || r["consent"] === "true")
            r["consent"] = true;
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
    /* Turnstile is on unless a site opts out in so many words. The check fails
       closed, so a site that has not set a secret rejects every submission: that
       is the right default, and the wrong one to arrive at by forgetting. A site
       that opts out keeps the honeypot, the time trap and the rate limits, which
       are the layers that cost the reader nothing. (§4.4) */
    if (options?.turnstile !== false) {
        const turnstile = await verifyTurnstile(lead.turnstileToken, ip ?? undefined, process.env["TURNSTILE_SECRET_KEY"]);
        if (!turnstile.ok) {
            console.warn(`[lead] turnstile rejected: ${turnstile.reason}`);
            return {
                status: 400,
                body: { ok: false, message: "Verification failed. Please reload and try again." },
            };
        }
    }
    /* The rate limiter reads the same database the lead is about to be written
       to, so it is the first thing to fail when that database is missing or
       unreachable, and it threw straight out of the handler. On Vercel an
       escaped throw is FUNCTION_INVOCATION_FAILED: a 500 with no body, which
       reads from outside as an ordinary server error and hides the real cause.
       Fail closed and say so in the log, because a lead that cannot be stored
       is a lead lost, and answering "thanks" to one would be worse. */
    let limit;
    try {
        limit = await checkRateLimits(ip, lead.email);
    }
    catch (err) {
        console.error(`[lead] rate-limit store unavailable: ${err instanceof Error ? err.message : String(err)}`);
        return {
            status: 503,
            body: { ok: false, message: "We cannot take enquiries right now. Please try again shortly." },
            headers: { "retry-after": "120" },
        };
    }
    if (!limit.allowed) {
        return {
            status: 429,
            body: { ok: false, message: "Too many enquiries. Please try again later." },
            headers: { "retry-after": String(limit.retryAfterSeconds) },
        };
    }
    let leadId;
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
    }
    catch (err) {
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
//# sourceMappingURL=handler.js.map