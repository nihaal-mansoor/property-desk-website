import { scanNoCrosslink } from "./no-crosslink.ts";
import { scanNoFabrication } from "./no-fabrication.ts";
import { scanNoListings } from "./no-listings.ts";
import { pathToFileURL } from "node:url";
import type { Finding } from "./scan.ts";

/**
 * The compliance third of the launch gate (CLAUDE.md §4.7).
 * Performance, accessibility and security are covered by their own tooling.
 *
 * Usage from a site:  node --experimental-strip-types \
 *   ../site-kit/src/testing/gate.ts ./dist yourdomain.com
 */

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function report(title: string, findings: readonly Finding[], scanned: number): boolean {
  if (findings.length === 0) {
    console.log(`${GREEN}✓${RESET} ${title} ${DIM}(${scanned} files)${RESET}`);
    return true;
  }
  console.log(`${RED}✗ ${title} — ${findings.length} finding(s)${RESET}`);
  for (const f of findings) {
    console.log(`  ${BOLD}${f.file}${RESET}  ${DIM}${f.rule}${RESET}`);
    console.log(`    ${f.message}`);
    console.log(`    ${DIM}${f.excerpt}${RESET}`);
  }
  return false;
}

export async function runComplianceGate(
  distDir: string,
  ownDomain: string,
): Promise<boolean> {
  console.log(`\n${BOLD}Compliance gate${RESET} ${DIM}${distDir}${RESET}\n`);

  const [listings, fabrication, crosslink] = await Promise.all([
    scanNoListings(distDir),
    scanNoFabrication(distDir),
    scanNoCrosslink(distDir, ownDomain),
  ]);

  if (listings.filesScanned === 0) {
    console.log(`${RED}✗ No HTML found in ${distDir}. Run the build first.${RESET}`);
    return false;
  }

  const ok = [
    report("§1.1 no property advertised", listings.findings, listings.filesScanned),
    report("§1.2 no fabricated credentials", fabrication.findings, fabrication.filesScanned),
    report("§1.3 no cross-linking", crosslink.findings, crosslink.filesScanned),
  ].every(Boolean);

  console.log(ok ? `\n${GREEN}Compliance gate passed.${RESET}\n` : `\n${RED}Compliance gate failed.${RESET}\n`);
  return ok;
}

/**
 * CLI entry.
 *
 * Guarded, because this module is also imported by application code that scans
 * user submissions. Unguarded, `process.argv.slice(2)` inside a host process
 * such as `next start -p 4455` parsed as (dist, domain), ran a scan against a
 * directory called "start", and called process.exit() — killing the server that
 * imported it. A library must never read argv or exit on import.
 */
const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  const [distArg, domainArg] = process.argv.slice(2);
  if (!distArg || !domainArg) {
    console.error("usage: node gate.ts <dist-dir> <domain>");
    process.exit(2);
  }
  const passed = await runComplianceGate(distArg, domainArg);
  process.exit(passed ? 0 : 1);
}
