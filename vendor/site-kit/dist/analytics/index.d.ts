import type { SiteConfig } from "../config/types.ts";
/**
 * Consent-gated analytics. (CLAUDE.md §4.6)
 *
 * Nothing loads before opt-in and nothing loads before window `load`. Analytics
 * must never contend with the page for bandwidth — the CWV budget in §4.1
 * assumes this.
 *
 * Returns a script string to be injected with a CSP nonce. It is deliberately
 * dependency-free and small enough to inline.
 */
export declare const CONSENT_STORAGE_KEY = "uaeprop.consent.v1";
export interface ConsentState {
    readonly analytics: boolean;
    readonly decidedAt: string;
}
/**
 * Bootstrap: sets Consent Mode v2 defaults to `denied` BEFORE any tag loads,
 * then loads GA4 and Clarity only if prior consent is stored. Must be inlined
 * in <head> with a nonce so the denied default is registered first.
 */
export declare function consentBootstrapScript(config: SiteConfig): string;
/**
 * Conversion events are fired SERVER-SIDE on validated submission (§4.6), so
 * there is no client-side conversion tracking here by design. This helper is
 * for interaction events only — calculator used, WhatsApp clicked.
 */
export declare function trackEvent(name: string, params?: Record<string, string | number>): void;
//# sourceMappingURL=index.d.ts.map