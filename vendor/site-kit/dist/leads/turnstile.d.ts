/**
 * Cloudflare Turnstile verification. MUST run server-side — a client-side
 * "success" is worth nothing. (CLAUDE.md §4.4)
 */
export interface TurnstileResult {
    readonly ok: boolean;
    /** Machine-readable reason, for server logs only. Never shown to the client. */
    readonly reason?: string;
}
export declare function verifyTurnstile(token: string | undefined, remoteIp: string | undefined, secret: string | undefined): Promise<TurnstileResult>;
//# sourceMappingURL=turnstile.d.ts.map