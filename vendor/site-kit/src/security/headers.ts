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

const CLARITY_SCRIPT = ["https://www.clarity.ms"];
const CLARITY_CONNECT = ["https://*.clarity.ms"];
const CLARITY_IMG = ["https://*.clarity.ms"];

const ANALYTICS_SCRIPT = [
  "https://www.googletagmanager.com",
  // Vercel Analytics and Speed Insights. Production serves these from the same
  // origin under /_vercel/insights, but development and some configurations
  // load them from this host instead.
  "https://va.vercel-scripts.com",
];
const ANALYTICS_CONNECT = [
  "https://va.vercel-scripts.com",
  "https://vitals.vercel-insights.com",
  "https://www.google-analytics.com",
  "https://analytics.google.com",
  "https://www.googletagmanager.com",
];
const ANALYTICS_IMG = [
  "https://www.google-analytics.com",
  "https://www.googletagmanager.com",
];
const TURNSTILE = ["https://challenges.cloudflare.com"];

/** Builds the CSP value. `{NONCE}` is substituted per response by middleware. */
export function buildCsp(options: CspOptions = {}): string {
  const useAnalytics = options.analytics !== false;
  const useTurnstile = options.turnstile !== false;
  // Defaults true so existing sites keep the CSP they were reviewed with.
  const useClarity = options.clarity !== false;

  const script = options.useNonce
    ? [
        "'self'",
        "'nonce-{NONCE}'",
        ...(options.strictDynamic ? ["'strict-dynamic'"] : []),
        ...(useAnalytics ? ANALYTICS_SCRIPT : []),
        ...(useAnalytics && useClarity ? CLARITY_SCRIPT : []),
        ...(useTurnstile ? TURNSTILE : []),
        ...(options.scriptSrc ?? []),
      ]
    : [
        "'self'",
        ...(useAnalytics ? ANALYTICS_SCRIPT : []),
        ...(useAnalytics && useClarity ? CLARITY_SCRIPT : []),
        ...(useTurnstile ? TURNSTILE : []),
        ...(options.scriptSrc ?? []),
      ];
  const connect = [
    "'self'",
    ...(useAnalytics ? ANALYTICS_CONNECT : []),
    ...(useAnalytics && useClarity ? CLARITY_CONNECT : []),
    ...(useTurnstile ? TURNSTILE : []),
    ...(options.connectSrc ?? []),
  ];
  const img = ["'self'", "data:",
    ...(useAnalytics ? ANALYTICS_IMG : []),
    ...(useAnalytics && useClarity ? CLARITY_IMG : []),
    ...(options.imgSrc ?? [])];
  const frame = useTurnstile ? TURNSTILE : ["'none'"];

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src ${script.join(" ")}`,
    // Styles are authored per site and compiled; inline style attributes are
    // unavoidable with utility CSS, so this is the one relaxation we accept.
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${img.join(" ")}`,
    `worker-src ${["'self'", ...(options.workerSrc ?? [])].join(" ")}`,
    `font-src 'self'`,
    `connect-src ${connect.join(" ")}`,
    `frame-src ${frame.join(" ")}`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

/** Substitutes a real nonce into a CSP built by buildCsp. */
export function cspWithNonce(csp: string, nonce: string): string {
  return csp.replaceAll("{NONCE}", nonce);
}

/** Cryptographically random, base64, per response. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export interface HeaderEntry {
  readonly key: string;
  readonly value: string;
}

/** The full header set for a site's vercel.json. */
export function securityHeaders(options: CspOptions = {}): HeaderEntry[] {
  return [
    { key: "Content-Security-Policy", value: buildCsp(options) },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
}

/** Ready-to-write vercel.json headers block. */
export function vercelHeadersConfig(options: CspOptions = {}) {
  return {
    headers: [{ source: "/(.*)", headers: securityHeaders(options) }],
  };
}
