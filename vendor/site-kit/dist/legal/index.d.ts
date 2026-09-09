/**
 * Portfolio-wide legal copy. (CLAUDE.md §1.4)
 *
 * The disclaimer is required in the footer of every page on every site. Being
 * explicit about the business model is a conversion asset — do not soften it.
 */
/** Required footer disclaimer. Brand is interpolated; the rest is fixed. */
export declare function disclaimer(brand: string): string;
/**
 * Exact consent wording stored alongside every lead. Versioned: if this string
 * changes, bump the version so existing records remain interpretable. (§4.4)
 */
export declare const CONSENT_VERSION = "2026-09-03.1";
export declare const CONSENT_TEXT: string;
/** Shown next to any figure sourced from a third party. (§4.7) */
export declare function sourcedAsOf(source: string, isoDate: string): string;
/** Required on any page discussing a named third-party development. */
export declare function notAffiliated(developer: string): string;
//# sourceMappingURL=index.d.ts.map