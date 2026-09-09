# @uaeprop/site-kit

Headless shared logic for the UAE property content network.

**No UI. No CSS. No components.** Every site owns its entire visual identity —
sharing presentation would undo the distinctiveness the portfolio depends on
(CLAUDE.md §1.5). This package holds only the logic that must behave identically
everywhere: compliance, lead handling, consent, and security headers.

## Modules

| Import | Contents |
|---|---|
| `@uaeprop/site-kit` | `defineSiteConfig`, disclaimer text, consent bootstrap |
| `.../leads` | Zod schema, WhatsApp builder, server handler, Neon client |
| `.../analytics` | Consent Mode v2 bootstrap, event helper |
| `.../security` | CSP builder, nonce generation, `vercel.json` headers |
| `.../testing` | The three compliance scanners and the gate runner |

## Using it in a site

```ts
// site.config.ts
import { defineSiteConfig, DEFAULT_CONTACT } from "@uaeprop/site-kit";

export default defineSiteConfig({
  brand: "Handover",
  domain: "dubairealestateadvice.com",
  tagline: "How buying property in Dubai actually works.",
  topic: "the Dubai buying process",
  contact: DEFAULT_CONTACT,
  analytics: { ga4MeasurementId: "G-XXXXXXX", clarityProjectId: "xxxxxxxx" },
  og: { image: "/og.png", imageAlt: "Handover" },
  contentReviewedAt: "2026-09-03",
});
```

```ts
// src/pages/api/lead.ts
import { handleLead } from "@uaeprop/site-kit/leads";
import config from "../../../site.config.ts";

export async function POST({ request }: { request: Request }) {
  const result = await handleLead(request, config);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json", ...result.headers },
  });
}
```

## Defence order in `handleLead`

Cheap local checks run before anything costing a round trip:

1. Method and origin
2. Zod schema — `.strict()`, so unknown keys are rejected
3. Honeypot and time-trap (both answer with a fake success — never teach the bot)
4. Turnstile, verified server-side, **fails closed** on outage
5. Rate limits, per IP and per email
6. Persist, then notify — a failed email never fails a saved lead

Client errors are generic; detail goes to the server log keyed by lead id, never PII.

## Compliance gate

```bash
node ../site-kit/src/testing/gate.ts ./dist yourdomain.com
```

Scans built HTML for §1.1 (no property advertised), §1.2 (no fabricated
credentials) and §1.3 (no cross-linking). Exits non-zero on any finding.

The listings rule distinguishes a specific unit from market data:

```
flagged   "2 bedroom apartment in Downtown, AED 2,400,000"
allowed   "Downtown apartments transacted at AED 1,650–2,400 per sq ft"
```

A price is only flagged when it sits near a specific-unit signal *and* no
market-level qualifier (`per sq ft`, `average`, `median`, `range`, `transacted`)
appears nearby.

## Database

Run once per environment before the first deploy:

```ts
import { migrate } from "@uaeprop/site-kit/leads";
await migrate();
```

Creates `leads` (with `source_domain` so enquiries are attributable per site,
and consent text + version stored per record) and `rate_limit`.

## Versioning

**Pinned per site.** A site upgrades deliberately, never implicitly — one bad
release must not be able to take down thirty live sites (§8).
