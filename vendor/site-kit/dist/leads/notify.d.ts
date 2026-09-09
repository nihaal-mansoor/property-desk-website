import type { SiteConfig } from "../config/types.ts";
/** Server-side email notification via Resend. Never called from the client. */
export interface NotifyInput {
    readonly leadId: number;
    readonly name: string;
    readonly email: string;
    readonly phone: string;
    readonly message: string | null;
    readonly sourcePage: string;
}
export declare function notifyByEmail(config: SiteConfig, lead: NotifyInput): Promise<{
    ok: boolean;
    reason?: string;
}>;
//# sourceMappingURL=notify.d.ts.map