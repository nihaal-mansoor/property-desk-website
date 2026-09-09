/**
 * The Open Graph card, drawn from the same data the page draws from.
 *
 * Every page declares og:image and the file did not exist, so every share
 * rendered a blank card. Generated rather than hand-designed so the headline
 * figure on the card cannot drift from the headline figure on the site.
 *
 * Run: node scripts/build-og.mjs   (needs a Chrome; see CHROME below)
 */
import { readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH
  ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 1200, H = 630;

const map = JSON.parse(readFileSync("src/data/map.json", "utf8"));
const s12 = map.summary["12m"];
const at = (c) => c.periods["12m"];
const active = map.communities.filter((c) => at(c)?.psf != null);

/* Same projection as the page's server-rendered fallback: equirectangular with
   a cosine correction, framed on the communities that actually have a market. */
const lons = active.flatMap((c) => c.rings.flat().map((p) => p[0]));
const lats = active.flatMap((c) => c.rings.flat().map((p) => p[1]));
const minX = Math.min(...lons), maxX = Math.max(...lons);
const minY = Math.min(...lats), maxY = Math.max(...lats);
const cosLat = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
const MW = 560, MH = 630, PAD = 30;
const scale = Math.min((MW - 2 * PAD) / ((maxX - minX) * cosLat), (MH - 2 * PAD) / (maxY - minY));
const px = (p) =>
  `${(PAD + (p[0] - minX) * cosLat * scale).toFixed(1)},${(MH - PAD - (p[1] - minY) * scale).toFixed(1)}`;

/* One hue, light to dark. Same ramp as the map. */
const RAMP = ["#EAF0F7", "#CBDCEC", "#A3C2DD", "#75A3CA", "#4A82B4", "#2A5F94", "#14406B", "#0B2A48"];
const sorted = active.map((c) => at(c).psf).sort((a, b) => a - b);
const breaks = RAMP.map((_, i) => sorted[Math.floor((sorted.length * i) / RAMP.length)]);
const band = (v) => {
  for (let i = RAMP.length - 1; i >= 0; i--) if (v >= breaks[i]) return RAMP[i];
  return RAMP[0];
};

const paths = active.map((c) =>
  `<path d="${c.rings.map((r) => `M${r.map(px).join("L")}Z`).join("")}" fill="${band(at(c).psf)}"/>`,
).join("");

const b64 = (f) => readFileSync(f).toString("base64");
const sans = b64("node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2");
const mono = b64("node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2");
const n = new Intl.NumberFormat("en-AE");

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:G;src:url(data:font/woff2;base64,${sans}) format('woff2-variations');font-weight:100 900}
@font-face{font-family:GM;src:url(data:font/woff2;base64,${mono}) format('woff2-variations');font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;display:flex;background:#0B0D10;color:#F2F4F6;font-family:G,sans-serif;overflow:hidden}
.left{width:${W - MW}px;padding:64px 48px 56px;display:flex;flex-direction:column;justify-content:space-between}
.brand{font-size:23px;font-weight:600;letter-spacing:-.02em}
.tag{font-size:16px;color:#8A939C;margin-top:6px}
h1{font-size:52px;line-height:1.06;letter-spacing:-.035em;font-weight:600;margin-top:34px}
.figs{display:flex;gap:40px;margin-top:auto;padding-top:30px}
.fig{border-top:1px solid #39424B;padding-top:11px}
.n{font-family:GM,monospace;font-size:31px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.l{font-size:14px;color:#8A939C;margin-top:5px}
.map{width:${MW}px;height:${MH}px;position:relative}
</style>
<div class="left">
  <div>
    <div class="brand">Property Desk</div>
    <div class="tag">What Dubai property actually sold for.</div>
    <h1>Dubai property prices,<br>community by community</h1>
  </div>
  <div class="figs">
    <div class="fig"><div class="n">${n.format(s12.psf)}</div><div class="l">Median AED per sqft</div></div>
    <div class="fig"><div class="n">${n.format(s12.sales)}</div><div class="l">Registered sales, 12 months</div></div>
  </div>
</div>
<div class="map"><svg width="${MW}" height="${MH}" viewBox="0 0 ${MW} ${MH}">${paths}</svg></div>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "public/og.png" });
await browser.close();

const kb = (readFileSync("public/og.png").length / 1024).toFixed(0);
console.log(`public/og.png  ${W}x${H}  ${kb} KB  (${active.length} communities drawn)`);
