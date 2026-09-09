/**
 * One shared leads table across the whole portfolio. Sites are distinguished by
 * source_domain — you cannot invoice a broker per lead from an inbox.
 *
 * Parameterised queries only. Never build SQL by string concatenation. (§4.3)
 */
export interface LeadRecord {
    readonly name: string;
    readonly email: string;
    readonly phone: string;
    readonly message: string | null;
    readonly sourceDomain: string;
    readonly sourcePage: string;
    readonly sourceTopic: string;
    readonly consentText: string;
    readonly consentVersion: string;
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
}
/** Idempotent. Run once per environment before the first deploy. */
export declare function migrate(): Promise<void>;
/** Returns the new lead's id. PII is never logged — log this id instead. (§4.4) */
export declare function insertLead(record: LeadRecord): Promise<number>;
/** Retention: purge leads older than 24 months. Run on a schedule. (§4.4) */
export declare function purgeExpiredLeads(): Promise<number>;
//# sourceMappingURL=db.d.ts.map