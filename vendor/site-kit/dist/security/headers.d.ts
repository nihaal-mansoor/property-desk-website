/**
 * Security headers, emitted into each site's vercel.json. (CLAUDE.md §4.3)
 *
 * No `unsafe-inline` and no `unsafe-eval` for scripts. Inline scripts carry a
 * per-response nonce instead — see cspWithNonce.
 */
export interface CspOptions {
    /** Extra script origins. Analytics hosts are included automatically. */
    readonly scriptSrc?: readonly string[];
    /** Extra connect origins for XHR/beacon. */
    readonly connectSrc?: readonly string[];
    /** Extra image origins. */
    readonly imgSrc?: readonly string[];
    /**
     * Worker origins. A map library compiles its tile decoder into a blob worker,
     * which `default-src 'self'` blocks outright, so a site with a map has to say
     * so explicitly rather than inherit a policy that silently breaks it.
     */
    readonly workerSrc?: readonly string[];
    /** Set false for sites with no forms and no analytics. */
    readonly analytics?: boolean;
    /** Set false for sites with no Turnstile widget. */
    readonly turnstile?: boolean;
    /**
     * Set false for sites that do not run Microsoft Clarity. Separate from
     * `analytics` because Clarity brings a wildcard origin, https://*.clarity.ms,
     * and a wildcard for a product a site does not use is allowlist that an
     * injection could aim at for nothing in return.
     */
    readonly clarity?: boolean;
    /**
     * Nonce mode. Requires per-response middleware to substitute {NONCE}.
     * Static sites should leave this false and serve all scripts as files —
     * 'strict-dynamic' ignores 'self', so a nonce CSP breaks plain <script src>.
     */
    readonly useNonce?: boolean;
    /**
     * Add 'strict-dynamic'. Off by default because it makes the browser ignore
     * 'self' and every host in the allowlist, which blocks any script injected by
     * a component that cannot attach a nonce — Vercel Analytics and Speed
     * Insights among them. Turn it on only when every script is nonced.
     */
    readonly strictDynamic?: boolean;
}
/** Builds the CSP value. `{NONCE}` is substituted per response by middleware. */
export declare function buildCsp(options?: CspOptions): string;
/** Substitutes a real nonce into a CSP built by buildCsp. */
export declare function cspWithNonce(csp: string, nonce: string): string;
/** Cryptographically random, base64, per response. */
export declare function generateNonce(): string;
export interface HeaderEntry {
    readonly key: string;
    readonly value: string;
}
/** The full header set for a site's vercel.json. */
export declare function securityHeaders(options?: CspOptions): HeaderEntry[];
/** Ready-to-write vercel.json headers block. */
export declare function vercelHeadersConfig(options?: CspOptions): {
    headers: {
        source: string;
        headers: HeaderEntry[];
    }[];
};
//# sourceMappingURL=headers.d.ts.map