import { neon } from "@neondatabase/serverless";

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

export const HOURLY: RateLimitRule = { limit: 5, windowSeconds: 3600 };
export const DAILY: RateLimitRule = { limit: 20, windowSeconds: 86_400 };

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

/**
 * Atomically increments a bucket and reports whether it is now over its limit.
 * The UPSERT resets the window when the previous one has expired.
 */
async function hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not configured.");
  const sql = neon(url);

  const rows = await sql`
    INSERT INTO rate_limit (bucket, count, expires_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${rule.windowSeconds}))
    ON CONFLICT (bucket) DO UPDATE SET
      count = CASE
        WHEN rate_limit.expires_at < now() THEN 1
        ELSE rate_limit.count + 1
      END,
      expires_at = CASE
        WHEN rate_limit.expires_at < now()
          THEN now() + make_interval(secs => ${rule.windowSeconds})
        ELSE rate_limit.expires_at
      END
    RETURNING count, EXTRACT(EPOCH FROM (expires_at - now()))::int AS retry_after
  `;

  const row = rows[0] as { count: number; retry_after: number };
  return {
    allowed: row.count <= rule.limit,
    retryAfterSeconds: Math.max(0, row.retry_after),
  };
}

/** Checks every applicable bucket. Any breach denies the request. */
export async function checkRateLimits(
  ip: string | null,
  email: string,
): Promise<RateLimitResult> {
  const checks: Promise<RateLimitResult>[] = [
    hit(`email:h:${email}`, HOURLY),
    hit(`email:d:${email}`, DAILY),
  ];
  if (ip) {
    checks.push(hit(`ip:h:${ip}`, HOURLY), hit(`ip:d:${ip}`, DAILY));
  }

  const results = await Promise.all(checks);
  const breach = results.find((r) => !r.allowed);
  return breach ?? { allowed: true, retryAfterSeconds: 0 };
}
