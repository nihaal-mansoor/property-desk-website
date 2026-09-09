import { type ScanResult } from "./scan.ts";
/**
 * CLAUDE.md §1.3 — the sites never link to each other.
 *
 * The strongest signal that a group of domains is one operation. This scans
 * built HTML for links to any other domain in the portfolio.
 */
/** Every domain in the network. Keep in sync with CLAUDE.md §5. */
export declare const PORTFOLIO_DOMAINS: readonly string[];
export declare function scanNoCrosslink(distDir: string, ownDomain: string): Promise<ScanResult>;
//# sourceMappingURL=no-crosslink.d.ts.map