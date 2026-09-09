/**
 * Server-side rate limiting, backed by Postgres. (CLAUDE.md §4.4)
 *
 * Limits are per IP and per email: 5/hour and 20/day. Postgres rather than a
 * dedicated store because these are low-traffic content sites and one less
 * external dependency is one less thing to fail.
 */
export interface RateLimitRule {
    readonly limit: number;
    readonly windowSeconds: number;
}
export declare const HOURLY: RateLimitRule;
export declare const DAILY: RateLimitRule;
export interface RateLimitResult {
    readonly allowed: boolean;
    readonly retryAfterSeconds: number;
}
/** Checks every applicable bucket. Any breach denies the request. */
export declare function checkRateLimits(ip: string | null, email: string): Promise<RateLimitResult>;
//# sourceMappingURL=ratelimit.d.ts.map