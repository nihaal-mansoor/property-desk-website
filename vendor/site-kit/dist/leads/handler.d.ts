import type { SiteConfig } from "../config/types.ts";
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
export declare function handleLead(request: Request, config: SiteConfig): Promise<HandlerResult>;
//# sourceMappingURL=handler.d.ts.map