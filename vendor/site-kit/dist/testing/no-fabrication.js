import { excerptAround, htmlFiles, readHtml, relativeTo, visibleText, } from "./scan.js";
const RULES = [
    {
        id: "licence-number",
        pattern: /\b(?:orn|brn|rera|trakheesi|permit\s*(?:no|number|#))\b[\s:#]*\d/gi,
        message: "Licence or permit number claimed. We hold none.",
    },
    {
        id: "founded",
        // Bare "since <year>" is how you cite a data baseline ("change since 2019"),
        // so it cannot be the trigger on its own. Only match a claim about US:
        // founded/established, or "serving/trading since".
        pattern: /\b(?:founded|established)\s*(?:in\s*)?(?:19|20)\d{2}\b|\best\.\s*(?:19|20)\d{2}\b|\b(?:serving|trading|operating|in business|helping)(?:\s+\S+){0,3}\s+since\s+(?:19|20)\d{2}\b/gi,
        message: "Founding-date or business-age claim. Not verifiable — remove.",
    },
    {
        id: "experience-years",
        pattern: /\b\d{1,2}\+?\s*years?\s+(?:of\s+)?(?:experience|expertise|in\s+(?:the\s+)?(?:dubai|uae))/gi,
        message: "Years-of-experience claim. Not verifiable — remove.",
    },
    {
        id: "client-count",
        pattern: /\b\d[\d,.]*\+?\s*(?:happy\s+)?(?:clients|customers|families|investors|transactions|properties\s+sold)\b/gi,
        message: "Client or transaction count. Not verifiable — remove.",
    },
    {
        id: "testimonial",
        pattern: /\b(?:testimonial|what our clients say|client reviews|5[\s-]star|rated\s+\d(?:\.\d)?\s*\/\s*5)\b/gi,
        message: "Testimonial or rating. Only real, consented reviews are permitted.",
    },
    {
        id: "award",
        // "certified" and "accredited" only count when they describe US. A third
        // party certifying something ("certified construction progress",
        // "certified complete") is accurate terminology, not a credential claim.
        pattern: /\b(?:award[- ]winning|as featured (?:in|on)|as seen (?:in|on)|official partner|authoris?ed (?:agent|partner|dealer)|(?:we (?:are|'re)\s+)?(?:fully\s+|officially\s+)?(?:certified|accredited)\s+(?:agent|broker|brokerage|advis[eo]r|partner|consultant|firm|company|professional)s?)\b/gi,
        message: "Award, certification or partnership claim about us. Remove.",
    },
    {
        id: "brokerage-self-description",
        pattern: /\bwe (?:are|'re)\s+(?:a\s+)?(?:leading|licensed|premier|top|trusted)\s+(?:real estate\s+)?(?:broker|brokerage|agency|agent)/gi,
        message: "Describes the site as a brokerage. We are not one — see §1.4.",
    },
    {
        id: "team-claim",
        pattern: /\bour team of\s+\d+|\bmeet (?:the|our) team\b/gi,
        message: "Team claim. No fabricated people (§1.2) — remove or make real.",
    },
];
export async function scanNoFabrication(distDir) {
    const files = await htmlFiles(distDir);
    const findings = [];
    for (const file of files) {
        const text = visibleText(await readHtml(file));
        const rel = relativeTo(distDir, file);
        for (const rule of RULES) {
            for (const match of text.matchAll(rule.pattern)) {
                findings.push({
                    file: rel,
                    rule: `no-fabrication/${rule.id}`,
                    excerpt: excerptAround(text, match.index ?? 0),
                    message: rule.message,
                });
            }
        }
    }
    return { findings, filesScanned: files.length };
}
//# sourceMappingURL=no-fabrication.js.map