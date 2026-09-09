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

/** wa.me requires digits only — no plus, no spaces. */
function waNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}

export function whatsappUrl(config: SiteConfig, options: WhatsAppOptions = {}): string {
  const base =
    options.message ??
    `Hi, I found ${config.brand} while reading about ${config.topic}. I'd like some help.`;

  const text = options.context ? `${base}\n\n${options.context}` : base;

  return `https://wa.me/${waNumber(config.contact.whatsapp)}?text=${encodeURIComponent(text)}`;
}

/** Human-readable form of the number, for display next to the link. */
export function whatsappDisplay(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("971") && d.length === 12) {
    return `+971 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  return e164;
}
