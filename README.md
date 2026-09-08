# propertydeskdubai.com — Property Desk

**The one thing:** what a Dubai purchase actually costs in cash on transfer day.

Every published calculator stops at the 4% transfer fee. This one itemises all
of it, ends at the cash figure, and shows what a short bank valuation does to
that figure, which is the surprise buyers report most and which no other
calculator models.

## Shape

- **Astro 7, static, no adapter.** Nothing here needs a server: the calculator
  runs in the browser and every page is prerendered. The Vercel adapter ships a
  vulnerable `path-to-regexp` with no patched release (CLAUDE.md §2).
- **No database, no accounts, no forms.** Whatever a visitor types stays in
  their browser, which matters because it would say what they are about to buy
  and what they can afford.
- **One source of truth for fees:** `src/lib/costs.ts`. The calculator and the
  written pages both read it, so a figure cannot be right in one and stale in
  the other. Each line carries its source and the date it was checked.

## Archetype

Stepped intake, then a live result. Square corners throughout, hairline rules
rather than cards, figures in mono with tabular numerals, one cool signal colour
used only on the number that matters. Deliberately unlike its siblings (§1.5):
Launch Register is warm, orange and heavily rounded; Handover is cream, green
and editorial with a serif.

## Commands

```bash
npm run dev              # local
npm run build            # static build to dist/
npm run gate             # build + html-validate + compliance
npm run gate:a11y        # html-validate across built routes
npm run gate:compliance  # §1.1 listings, §1.2 fabrication, §1.3 cross-links
node scripts-gen-vercel.mjs   # regenerate vercel.json headers from site-kit
```

## Before launch

The fee figures need re-checking against the Land Department and a lender, and
`CHECKED` in `src/lib/costs.ts` updated when they are. `site.config.ts` has empty
contact and analytics fields that are filled per domain, never committed.
