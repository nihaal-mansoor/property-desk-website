/**
 * Cloudflare Turnstile verification. MUST run server-side — a client-side
 * "success" is worth nothing. (CLAUDE.md §4.4)
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export async function verifyTurnstile(token, remoteIp, secret) {
    // Unconfigured is a deployment error, not a pass. Fail closed.
    if (!secret)
        return { ok: false, reason: "turnstile_secret_missing" };
    if (!token)
        return { ok: false, reason: "turnstile_token_missing" };
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp)
        body.set("remoteip", remoteIp);
    try {
        const res = await fetch(VERIFY_URL, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body,
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            return { ok: false, reason: `turnstile_http_${res.status}` };
        const data = (await res.json());
        if (data.success === true)
            return { ok: true };
        return { ok: false, reason: (data["error-codes"] ?? ["unknown"]).join(",") };
    }
    catch (err) {
        // Network failure or timeout. Fail closed — a bot must not benefit from an outage.
        return { ok: false, reason: err instanceof Error ? err.name : "turnstile_error" };
    }
}
//# sourceMappingURL=turnstile.js.map