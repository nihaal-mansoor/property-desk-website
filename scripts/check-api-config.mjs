/**
 * api/lead.ts declares its own copy of the site's identity, because importing
 * ../site.config.ts from inside a Vercel Function crashed the function at
 * module load. §6.1 says there is one source of truth, so the copy has to be
 * provably in step with it rather than merely intended to be.
 *
 * This asserts the two agree, and the build runs it. A rename in
 * site.config.ts that is not carried across now fails the build instead of
 * quietly tagging every lead with a stale domain.
 */
import { readFile } from "node:fs/promises";

const FIELDS = ["brand", "domain", "tagline", "topic", "contentReviewedAt"];

/** Both files are small and literal; a regex read avoids importing TS here. */
function read(source, field) {
  const m = new RegExp(`\\b${field}\\s*:\\s*"([^"]*)"`).exec(source);
  return m ? m[1] : null;
}

const site = await readFile(new URL("../site.config.ts", import.meta.url), "utf8");
const api = await readFile(new URL("../api/lead.ts", import.meta.url), "utf8");

const problems = [];
for (const f of FIELDS) {
  const a = read(site, f);
  const b = read(api, f);
  if (a === null) problems.push(`site.config.ts does not declare ${f}`);
  else if (b === null) problems.push(`api/lead.ts does not declare ${f}`);
  else if (a !== b) problems.push(`${f}: site.config.ts has ${JSON.stringify(a)}, api/lead.ts has ${JSON.stringify(b)}`);
}

if (problems.length) {
  console.error("api/lead.ts has drifted from site.config.ts:");
  for (const p of problems) console.error(`  ${p}`);
  console.error("\nUpdate api/lead.ts to match, then rerun.");
  process.exit(1);
}
console.log(`api config in step with site.config.ts (${FIELDS.length} fields)`);
