import { z } from "zod";
/**
 * ONE schema, shared by client and server. (CLAUDE.md §4.4)
 *
 * The client copy is UX only. The server ALWAYS revalidates with this same schema
 * and never trusts client input.
 */
/** Rejects anything containing HTML/angle brackets. Free text is plain text. */
const noMarkup = (field) => z
    .string()
    .refine((v) => !/[<>]/.test(v), { message: `${field} must not contain HTML.` });
/** Normalises a UAE-or-international phone to E.164. Returns null if unparseable. */
export function toE164(raw) {
    const trimmed = raw.trim();
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15)
        return null;
    if (hasPlus)
        return `+${digits}`;
    // Local UAE formats: 0521234567 / 521234567 -> +971521234567
    if (digits.startsWith("971"))
        return `+${digits}`;
    if (digits.startsWith("0"))
        return `+971${digits.slice(1)}`;
    if (digits.length === 9)
        return `+971${digits}`;
    return `+${digits}`;
}
export const leadSchema = z
    .object({
    name: noMarkup("Name").pipe(z.string().trim().min(2).max(80)),
    email: z
        .string()
        .trim()
        .toLowerCase()
        .max(254)
        .email("Enter a valid email address."),
    phone: z
        .string()
        .trim()
        .min(7)
        .max(24)
        .transform((v, ctx) => {
        const e164 = toE164(v);
        if (!e164) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number." });
            return z.NEVER;
        }
        return e164;
    }),
    message: noMarkup("Message").pipe(z.string().trim().max(1000)).optional(),
    /** Must be explicitly ticked. Unticked by default in the UI. (§4.4) */
    consent: z.literal(true, {
        errorMap: () => ({ message: "Please confirm you agree to be contacted." }),
    }),
    /** Which site and tool produced this lead. Set server-side from config. */
    sourceDomain: z.string().max(120).optional(),
    sourcePage: z.string().max(300).optional(),
    sourceTopic: z.string().max(160).optional(),
    /** Honeypot — must be empty. Hidden from real users and from assistive tech. */
    company: z.string().max(0, "Rejected.").optional().default(""),
    /** Client timestamp at form render, used for the time-trap. */
    renderedAt: z.coerce.number().int().nonnegative().optional(),
    /** Cloudflare Turnstile token, verified server-side. */
    turnstileToken: z.string().max(4096).optional(),
})
    .strict(); // unknown keys are rejected, not silently stripped
/** Client-side subset: everything the user actually fills in. */
export const leadFormSchema = leadSchema.pick({
    name: true,
    email: true,
    phone: true,
    message: true,
    consent: true,
});
/** Minimum milliseconds between form render and submit. Faster than this is a bot. */
export const MIN_SUBMIT_MS = 2000;
/** Field-keyed errors for rendering next to inputs via aria-describedby. (§4.2) */
export function fieldErrors(error) {
    const out = {};
    for (const issue of error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in out))
            out[key] = issue.message;
    }
    return out;
}
//# sourceMappingURL=schema.js.map