/**
 * Portfolio-wide legal copy. (CLAUDE.md §1.4)
 *
 * The disclaimer is required in the footer of every page on every site. Being
 * explicit about the business model is a conversion asset — do not soften it.
 */
/** Required footer disclaimer. Brand is interpolated; the rest is fixed. */
export function disclaimer(brand) {
    return (`${brand} is an independent property research resource. We are not a licensed ` +
        `real estate broker and do not sell, list, or transact property. We introduce ` +
        `readers to licensed brokers and may be paid for that introduction.`);
}
/**
 * Exact consent wording stored alongside every lead. Versioned: if this string
 * changes, bump the version so existing records remain interpretable. (§4.4)
 */
export const CONSENT_VERSION = "2026-09-03.1";
export const CONSENT_TEXT = "I agree to be contacted about my enquiry and for my details to be shared with " +
    "a licensed real estate broker in the UAE. I can withdraw consent at any time.";
/** Shown next to any figure sourced from a third party. (§4.7) */
export function sourcedAsOf(source, isoDate) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    const formatted = d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
    return `Source: ${source}, as of ${formatted}.`;
}
/** Required on any page discussing a named third-party development. */
export function notAffiliated(developer) {
    return (`This page is independent editorial content. We are not affiliated with, ` +
        `endorsed by, or authorised to act for ${developer}.`);
}
//# sourceMappingURL=index.js.map