/**
 * §4.2: axe-core must report zero violations on every route, in both themes.
 *
 * html-validate covers static rules only. It cannot see contrast, focus order,
 * or a live region attached to a role="application" canvas, which is exactly
 * the shape this site is. Run against the served build, not the source.
 */
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://localhost:4502";
const ROUTES = ["/", "/method", "/privacy", "/terms", "/404.html"];
const CHROME = process.env.CHROME_PATH
  ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const axe = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: "new",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

let total = 0;
for (const theme of ["light", "dark"]) {
  for (const route of ROUTES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
    await page.goto(BASE + route, { waitUntil: "networkidle2" });
    // The map paints asynchronously; auditing before it settles audits nothing.
    await new Promise((r) => setTimeout(r, route === "/" ? 9000 : 1200));
    await page.evaluate(axe);
    const res = await page.evaluate(async () =>
      await window.axe.run(document, { resultTypes: ["violations"] }));
    const v = res.violations;
    total += v.length;
    console.log(`${v.length ? "✗" : "✓"} ${theme.padEnd(5)} ${route.padEnd(9)} ${v.length} violation(s)`);
    for (const x of v) {
      console.log(`    [${x.impact}] ${x.id}: ${x.help}`);
      for (const n of x.nodes.slice(0, 2)) console.log(`      ${n.target.join(" ")}`);
    }
    await page.close();
  }
}
await browser.close();
console.log(total ? `\naxe: ${total} violation(s)` : "\naxe: clean across 5 routes in both themes");
process.exit(total ? 1 : 0);
