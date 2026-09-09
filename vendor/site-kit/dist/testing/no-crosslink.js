import { htmlFiles, readHtml, relativeTo } from "./scan.js";
/**
 * CLAUDE.md §1.3 — the sites never link to each other.
 *
 * The strongest signal that a group of domains is one operation. This scans
 * built HTML for links to any other domain in the portfolio.
 */
/** Every domain in the network. Keep in sync with CLAUDE.md §5. */
export const PORTFOLIO_DOMAINS = [
    "dubairealestateadvice.com",
    "emiratesrealtygroup.com",
    "signaturedubaiproperties.com",
    "primeuaeproperties.com",
    "dubaipremierproperties.com",
    "paramounteliteliving.com",
    "offplandxbgroup.com",
    "elitecapitaldubai.com",
    "dkpropertiesgroup.ae",
    "premiumdubaiproperties.net",
    "addressclubdubai.com",
    "propertydeskdubai.com",
    "lifestyleavenues.com",
    "crownluxedubai.com",
    "dubaiharbourheights.com",
    "dubaipremiumedge.com",
    "dubaioffplanlaunches.com",
    "burjcapitalae.com",
    "springluxefrontier.com",
    "buydowntowndubai.com",
    "theacres-bymeraas.com",
    "eliteresidencesdubai.com",
    "buy-palmjebelali.com",
    "dubaiexclusiveestates.com",
    "premiumvillasindubai.com",
    "premiumpenthousedubai.com",
    "dubaimainland.community",
    "offplanprojects.center",
    "dxbdreamhome.com",
    "premiumpropertyhub.com",
    "dxbpropertyaccess.com",
    "myproperties-access.com",
];
export async function scanNoCrosslink(distDir, ownDomain) {
    const files = await htmlFiles(distDir);
    const findings = [];
    const others = PORTFOLIO_DOMAINS.filter((d) => d !== ownDomain);
    for (const file of files) {
        const html = await readHtml(file);
        const rel = relativeTo(distDir, file);
        for (const domain of others) {
            // Match the domain as a host, not as incidental text.
            const pattern = new RegExp(`(?:https?:)?//(?:www\\.)?${domain.replace(/[.]/g, "\\.")}`, "gi");
            for (const match of html.matchAll(pattern)) {
                findings.push({
                    file: rel,
                    rule: "no-crosslink/portfolio-domain",
                    excerpt: match[0],
                    message: `Links to portfolio domain ${domain}. Sites must never link to each other (§1.3).`,
                });
            }
        }
    }
    return { findings, filesScanned: files.length };
}
//# sourceMappingURL=no-crosslink.js.map