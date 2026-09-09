import { excerptAround, htmlFiles, readHtml, relativeTo, visibleText, } from "./scan.js";
/**
 * CLAUDE.md §1.1 / §6.4 — no property may be advertised.
 *
 * The distinction that matters is SPECIFIC UNIT versus MARKET LEVEL:
 *
 *   flagged  "2 bedroom apartment in Downtown, AED 2,400,000"
 *   allowed  "Downtown apartments transacted at AED 1,650–2,400 per sq ft"
 *
 * So a price is only a listing when it sits near a specific-unit signal (a
 * bedroom count, a unit number, "this villa") AND no market-level qualifier
 * (per sq ft, average, median, range, transacted) is present nearby.
 *
 * Tune the vocabulary. Never disable the rule — if it blocks legitimate copy,
 * rewrite the copy. (§6.4)
 */
const PROXIMITY = 90;
/** Requires at least one digit — a bare comma is not a price. */
const MONEY = /(?:aed|dhs?|د\.إ)\s*\d[\d,.]*\s*(?:m|k|mn|million|thousand)?|\b\d[\d,.]*\s*(?:m|k|mn|million)?\s*(?:aed|dhs?)\b/gi;
/** A price near any of these is describing one purchasable unit. */
const SPECIFIC_UNIT = [
    { id: "bedroom-count", re: /\b\d+\s*(?:-|\s)?bed(?:room)?s?\b/i },
    { id: "studio", re: /\bstudio\b/i },
    {
        id: "demonstrative",
        re: /\bthis\s+(?:unit|apartment|villa|penthouse|townhouse|duplex|property|home)\b/i,
    },
    { id: "unit-number", re: /\b(?:unit|apt\.?|villa|plot)\s*(?:no\.?|#|number)\s*[\w-]+/i },
];
/** Presence of any of these means the figure is market data, not an offer. */
const MARKET_LEVEL = [
    /per\s+(?:sq\.?\s*(?:ft|m)\b|square\s+(?:foot|feet|met(?:re|er)s?))/i,
    /\bp\.?s\.?f\.?\b/i,
    /\b(?:average|median|mean|typical(?:ly)?|index|benchmark|indicative)\b/i,
    /\b(?:ranges?|ranged|ranging|between|transacted|achieved|recorded)\b/i,
    /\b(?:per year|per annum|annually|per month|deposit|fee|charge|budget)\b/i,
];
/** Marketing language that is an advertisement regardless of any price. */
const OFFER_TERMS = [
    "for sale",
    "available now",
    "now available",
    "book now",
    "reserve now",
    "buy now",
    "enquire about this",
    "register interest",
    "last unit",
    "limited units",
    "units remaining",
    "starting from",
    "starting at",
    "price from",
    "prices from",
    "exclusive offer",
    "payment plan available",
];
function matchesAny(window, patterns) {
    return patterns.some((re) => re.test(window));
}
export async function scanNoListings(distDir) {
    const files = await htmlFiles(distDir);
    const findings = [];
    for (const file of files) {
        const text = visibleText(await readHtml(file)).toLowerCase();
        const rel = relativeTo(distDir, file);
        const seen = new Set();
        for (const term of OFFER_TERMS) {
            const at = text.indexOf(term);
            if (at === -1)
                continue;
            findings.push({
                file: rel,
                rule: "no-listings/offer-language",
                excerpt: excerptAround(text, at),
                message: `Offer language "${term}" reads as an advertisement. Requires a Trakheesi permit — rewrite as market information.`,
            });
        }
        for (const match of text.matchAll(MONEY)) {
            const at = match.index ?? 0;
            const window = text.slice(Math.max(0, at - PROXIMITY), Math.min(text.length, at + match[0].length + PROXIMITY));
            // Market-level qualifier wins — this is data, not an offer.
            if (matchesAny(window, MARKET_LEVEL))
                continue;
            const unit = SPECIFIC_UNIT.find(({ re }) => re.test(window));
            if (!unit)
                continue;
            // One finding per rule per sentence, not per price in a list.
            const key = `${unit.id}:${Math.floor(at / PROXIMITY)}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            findings.push({
                file: rel,
                rule: "no-listings/price-near-unit",
                excerpt: excerptAround(text, at),
                message: `Price "${match[0].trim()}" sits near a specific-unit signal (${unit.id}). Use area-level ranges with a market qualifier such as "per sq ft" or "average".`,
            });
        }
    }
    return { findings, filesScanned: files.length };
}
//# sourceMappingURL=no-listings.js.map