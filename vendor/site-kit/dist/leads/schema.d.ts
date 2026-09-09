import { z } from "zod";
/** Normalises a UAE-or-international phone to E.164. Returns null if unparseable. */
export declare function toE164(raw: string): string | null;
export declare const leadSchema: z.ZodObject<{
    name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    email: z.ZodString;
    phone: z.ZodEffects<z.ZodString, string, string>;
    message: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    /** Must be explicitly ticked. Unticked by default in the UI. (§4.4) */
    consent: z.ZodLiteral<true>;
    /** Which site and tool produced this lead. Set server-side from config. */
    sourceDomain: z.ZodOptional<z.ZodString>;
    sourcePage: z.ZodOptional<z.ZodString>;
    sourceTopic: z.ZodOptional<z.ZodString>;
    /** Honeypot — must be empty. Hidden from real users and from assistive tech. */
    company: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    /** Client timestamp at form render, used for the time-trap. */
    renderedAt: z.ZodOptional<z.ZodNumber>;
    /** Cloudflare Turnstile token, verified server-side. */
    turnstileToken: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    name: string;
    email: string;
    phone: string;
    consent: true;
    company: string;
    message?: string | undefined;
    sourceDomain?: string | undefined;
    sourcePage?: string | undefined;
    sourceTopic?: string | undefined;
    renderedAt?: number | undefined;
    turnstileToken?: string | undefined;
}, {
    name: string;
    email: string;
    phone: string;
    consent: true;
    message?: string | undefined;
    sourceDomain?: string | undefined;
    sourcePage?: string | undefined;
    sourceTopic?: string | undefined;
    company?: string | undefined;
    renderedAt?: number | undefined;
    turnstileToken?: string | undefined;
}>;
export type LeadInput = z.input<typeof leadSchema>;
export type Lead = z.output<typeof leadSchema>;
/** Client-side subset: everything the user actually fills in. */
export declare const leadFormSchema: z.ZodObject<Pick<{
    name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    email: z.ZodString;
    phone: z.ZodEffects<z.ZodString, string, string>;
    message: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    /** Must be explicitly ticked. Unticked by default in the UI. (§4.4) */
    consent: z.ZodLiteral<true>;
    /** Which site and tool produced this lead. Set server-side from config. */
    sourceDomain: z.ZodOptional<z.ZodString>;
    sourcePage: z.ZodOptional<z.ZodString>;
    sourceTopic: z.ZodOptional<z.ZodString>;
    /** Honeypot — must be empty. Hidden from real users and from assistive tech. */
    company: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    /** Client timestamp at form render, used for the time-trap. */
    renderedAt: z.ZodOptional<z.ZodNumber>;
    /** Cloudflare Turnstile token, verified server-side. */
    turnstileToken: z.ZodOptional<z.ZodString>;
}, "message" | "name" | "email" | "phone" | "consent">, "strict", z.ZodTypeAny, {
    name: string;
    email: string;
    phone: string;
    consent: true;
    message?: string | undefined;
}, {
    name: string;
    email: string;
    phone: string;
    consent: true;
    message?: string | undefined;
}>;
/** Minimum milliseconds between form render and submit. Faster than this is a bot. */
export declare const MIN_SUBMIT_MS = 2000;
/** Field-keyed errors for rendering next to inputs via aria-describedby. (§4.2) */
export declare function fieldErrors(error: z.ZodError): Record<string, string>;
//# sourceMappingURL=schema.d.ts.map