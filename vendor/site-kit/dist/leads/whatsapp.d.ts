import type { SiteConfig } from "../config/types.ts";
/**
 * Click-to-WhatsApp is the primary CTA on every site. The prefilled message
 * carries the brand and topic so the enquiry source is obvious without
 * opening the database.
 */
export interface WhatsAppOptions {
    /** Overrides the default message. Keep it short — it is editable by the user. */
    readonly message?: string;
    /** Appended context, e.g. the calculator result the reader was looking at. */
    readonly context?: string;
}
export declare function whatsappUrl(config: SiteConfig, options?: WhatsAppOptions): string;
/** Human-readable form of the number, for display next to the link. */
export declare function whatsappDisplay(e164: string): string;
//# sourceMappingURL=whatsapp.d.ts.map