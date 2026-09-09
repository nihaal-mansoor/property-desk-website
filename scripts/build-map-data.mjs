/**
 * Builds the map from the public record.
 *
 *   node scripts/build-map-data.mjs
 *
 * Three sources have to be joined and the obvious join is wrong. Transaction
 * `area_id` and the boundary file's `COMM_NUM` are different numbering systems
 * that overlap in range, so joining them directly appears to work for about a
 * third of areas and silently paints one neighbourhood's prices onto another.
 * `lkp_areas` carries both keys and is the only correct bridge:
 *
 *   transactions.area_id -> lkp_areas.municipality_number -> KML COMM_NUM
 *
 * That covers 99.1% of 1.78M transactions.
 */
import { readFileSync, writeFileSync, readdirSync, createReadStream } from "node:fs";
import readline from "node:readline";
import path from "node:path";

const ROOT = path.resolve("..");
const OUT = "src/data/map.json";
const KML = path.join(ROOT, "community_2026-08-25_01-41-00.kml");
const LKP = path.join(ROOT, "lkp_areas_2026-09-01_17-53-16_0001.csv");
const TX = path.join(ROOT, "data/dubai-land-department/transactions");

/* Official cadastral names are not what anyone searches for. This is the part
   that makes the map usable rather than merely correct. */
const COMMON = {
  "MARSA DUBAI": "Dubai Marina",
  "AL THANYAH FIFTH": "Jumeirah Lake Towers",
  "AL BARSHA SOUTH FOURTH": "Jumeirah Village Circle",
  "BURJ KHALIFA": "Downtown Dubai",
  "AL THANYAH THIRD": "Emirates Hills / The Greens",
  "AL HEBIAH FOURTH": "Dubai Sports City",
  "AL HEBIAH THIRD": "Dubai Production City",
  "AL HEBIAH FIFTH": "Dubai Studio City",
  "WADI AL SAFA 5": "Dubailand / Liwan",
  "WADI AL SAFA 7": "Dubailand / Al Barari",
  "AL MERKADH": "Nad Al Sheba / Meydan",
  "JABAL ALI FIRST": "Jebel Ali / Discovery Gardens",
  "MADINAT AL MATAAR": "Dubai South",
  "AL WARSAN FIRST": "International City",
  "WARSAN FIRST": "International City",
  "NAKHLAT JUMEIRA": "Palm Jumeirah",
  "AL SAFOUH FIRST": "Al Sufouh / Media City",
  "AL SAFOUH SECOND": "Knowledge Village",
  "TRADE CENTER FIRST": "DIFC",
  "TRADE CENTER SECOND": "World Trade Centre",
  "AL KHAIRAN FIRST": "Dubai Creek Harbour",
  "AL JADAF": "Al Jaddaf",
  "ZAABEEL SECOND": "Zabeel",
  "AL BARSHA FIRST": "Al Barsha",
  "BUSINESS BAY": "Business Bay",
  "JUMEIRA FIRST": "Jumeirah 1",
  "JUMEIRA SECOND": "Jumeirah 2",
  "JUMEIRA THIRD": "Jumeirah 3",
  "MIRDIF": "Mirdif",
  "AL QUOZ INDUSTRIAL THIRD": "Al Quoz",
  "ME'AISEM FIRST": "IMPZ / Production City",
  "HADAEQ SHEIKH MOHAMMED BIN RASHID": "Mohammed Bin Rashid City",
  "WADI AL SAFA 3": "Dubailand",
  "AL YELAYISS 2": "Town Square",
  "AL YELAYISS 1": "Dubailand",
  "AL KHEERAN": "Ras Al Khor",
  "PALM JEBEL ALI": "Palm Jebel Ali",
  "WORLD ISLANDS": "The World Islands",
  "ISLAND 2": "Bluewaters / Island 2",
};

/* ---------- boundaries ---------- */
const kml = readFileSync(KML, "utf8");
const polys = new Map();
for (const pm of kml.match(/<Placemark[\s\S]*?<\/Placemark>/g) ?? []) {
  const attrs = {};
  for (const m of pm.matchAll(/<th>([A-Z_0-9]+)<\/th>\s*<td>([\s\S]*?)<\/td>/g)) {
    attrs[m[1]] = m[2].trim();
  }
  const num = attrs["COMM_NUM"];
  if (!num) continue;
  const rings = [];
  for (const c of pm.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)) {
    const pts = c[1].trim().split(/\s+/).map((t) => {
      const [lon, lat] = t.split(",").map(Number);
      return [lon, lat];
    }).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    if (pts.length > 3) rings.push(pts);
  }
  if (rings.length) polys.set(num, { name: attrs["CNAME_E"] ?? "", rings });
}

/* ---------- the bridge ---------- */
const lkp = new Map();
{
  const rows = readFileSync(LKP, "utf8").split(/\r?\n/).slice(1);
  for (const line of rows) {
    const cells = line.match(/"([^"]*)"/g)?.map((s) => s.slice(1, -1)) ?? [];
    if (cells.length < 4) continue;
    const areaId = cells[0].replace(/\.0+$/, "");
    if (areaId && cells[1]) lkp.set(areaId, cells[1]);
  }
}

/* ---------- transactions ---------- */
const now = new Date("2026-09-04");
const cut12 = new Date(now); cut12.setFullYear(now.getFullYear() - 1);
/** Studio through to 7 B/R, and penthouses. Excludes Shop, Office, Land. */
const RESIDENTIAL = /^(studio|\d+\s*b\/r|penthouse)/i;

let latest = "";
/**
 * One sample per sale, kept with its date, and bucketed into periods at the
 * end. Storing a separate array per period would hold the same value four or
 * five times over, once for every window it falls inside.
 */
const stats = new Map();
const get = (m) => {
  if (!stats.has(m)) {
    stats.set(m, {
      /* [days since epoch, psf, price, sqft, rooms, offplan, project] */
      sales: [],
      mortgages: [],   // dates only
      recent: [],
    });
  }
  return stats.get(m);
};
const DAY_MS = 86_400_000;
const dayOf = (iso) => Math.floor(new Date(iso).getTime() / DAY_MS);

// Streamed, not read whole: the transaction files are larger than the longest
// string Node will allocate.
for (const file of readdirSync(TX).filter((f) => f.endsWith(".csv"))) {
  const rl = readline.createInterface({
    input: createReadStream(path.join(TX, file), "utf8"),
    crlfDelay: Infinity,
  });
  let ix = null;
  for await (const line of rl) {
    if (!line) continue;
    if (!ix) {
      const head = line.split(",").map((h) => h.replace(/"/g, ""));
      ix = Object.fromEntries(head.map((h, i) => [h, i]));
      continue;
    }
    const cells = line.split('","').map((c) => c.replace(/^"|"$/g, ""));
    const mun = lkp.get(cells[ix["area_id"]]);
    if (!mun) continue;
    const s = get(mun);
    const group = cells[ix["trans_group_en"]];
    const date = (cells[ix["instance_date"]] ?? "").slice(0, 10);
    if (!date) continue;
    if (date > latest) latest = date;

    if (group === "Mortgages") { s.mortgages.push(dayOf(date)); continue; }
    if (group !== "Sales") continue;

    const psm = Number(cells[ix["meter_sale_price"]]);
    const psf = psm > 1000 && psm < 200000 ? psm / 10.7639 : null;
    const worth = Number(cells[ix["actual_worth"]]);
    const sqm = Number(cells[ix["procedure_area"]]);
    const sqft = sqm > 0 ? Math.round(sqm * 10.7639) : null;
    const rooms = (cells[ix["rooms_en"]] ?? "").trim();
    const offplan = cells[ix["reg_type_en"]] === "Off-Plan Properties";
    const project = (cells[ix["project_name_en"]] ?? "").trim();

    s.sales.push([dayOf(date), psf, worth > 0 ? worth : null, sqft,
                  RESIDENTIAL.test(rooms) ? rooms : null, offplan ? 1 : 0, project || null]);

    if (worth > 0 && sqft) {
      s.recent.push({ d: date, r: rooms || null, ft: sqft, w: Math.round(worth), o: offplan ? 1 : 0 });
      if (s.recent.length > 600) {
        s.recent.sort((a, b) => (a.d < b.d ? 1 : -1));
        s.recent.length = 40;
      }
    }
  }
}

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* ---------- simplify ---------- */
/* Douglas-Peucker. The raw KML is 2.2 MB, most of it coordinate precision no
   screen can show. */
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const sq = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const segDist = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    return sq(p, [x, y]);
  };
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0, idx = 0;
    for (let i = first + 1; i < last; i++) {
      const d = segDist(pts[i], pts[first], pts[last]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol * tol) { keep[idx] = true; stack.push([first, idx], [idx, last]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/* The cadastral register abbreviates "industrial" and does not always put a
   space after the full stop, so twelve communities arrive as "AL QOUZ
   IND.SECOND". Expanded here rather than in twelve COMMON entries. */
const titleCase = (s) =>
  s.trim().toLowerCase()
    .replace(/\bind\.\s*/g, "industrial ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

/* ---------- assemble ---------- */
/**
 * Periods, each measured against the equally long window before it, so growth
 * always compares like with like. A twelve month figure set against a six year
 * baseline would flatter everything.
 */
const PERIODS = [
  { id: "12m", label: "Last 12 months", days: 365 },
  { id: "3y", label: "Last 3 years", days: 365 * 3 },
  { id: "5y", label: "Last 5 years", days: 365 * 5 },
  { id: "10y", label: "Last 10 years", days: 365 * 10 },
];

const latestDay = dayOf(latest);

function periodStats(s, days) {
  const from = latestDay - days;
  const prevFrom = from - days;

  const inWindow = s.sales.filter((r) => r[0] >= from);
  if (!inWindow.length) return null;

  const psf = median(inWindow.map((r) => r[1]).filter(Boolean));
  const prevPsf = median(
    s.sales.filter((r) => r[0] >= prevFrom && r[0] < from).map((r) => r[1]).filter(Boolean),
  );

  const offplan = inWindow.filter((r) => r[5]).length;
  const mortgages = s.mortgages.filter((d) => d >= from).length;

  /* The typical sale, which replaces the budget answer: a concrete sentence
     rather than a ratio. Uses the commonest bedroom count, not the dearest. */
  const byRooms = new Map();
  for (const r of inWindow) {
    if (!r[4] || !r[2] || !r[3]) continue;
    if (!byRooms.has(r[4])) byRooms.set(r[4], { w: [], ft: [] });
    const b = byRooms.get(r[4]);
    b.w.push(r[2]); b.ft.push(r[3]);
  }
  let typical = null;
  let most = 0;
  for (const [rooms, v] of byRooms) {
    if (v.w.length > most) {
      most = v.w.length;
      typical = { rooms, price: Math.round(median(v.w)), sqft: Math.round(median(v.ft)), n: v.w.length };
    }
  }

  const projects = new Map();
  for (const r of inWindow) if (r[6]) projects.set(r[6], (projects.get(r[6]) ?? 0) + 1);

  return {
    psf: inWindow.filter((r) => r[1]).length >= 20 ? Math.round(psf) : null,
    growth: psf && prevPsf ? +(((psf - prevPsf) / prevPsf) * 100).toFixed(1) : null,
    sales: inWindow.length,
    offplan: Math.round((offplan / inWindow.length) * 100),
    financed: Math.round((mortgages / inWindow.length) * 100),
    typical,
    projects: [...projects].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, n })),
  };
}

const communities = [];
for (const [num, poly] of polys) {
  const maxLon = Math.max(...poly.rings.flat().map((p) => p[0]));
  if (maxLon > 55.75) continue;
  const s = stats.get(num);

  const periods = {};
  for (const p of PERIODS) periods[p.id] = s ? periodStats(s, p.days) : null;

  communities.push({
    id: num,
    name: poly.name,
    common: COMMON[poly.name] ?? null,
    rings: poly.rings.map((r) => simplify(r, 0.0004).map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)])),
    periods,
    recent: (s?.recent ?? []).sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 8),
  });
}

/* Geometry carries one flattened set of numbers per period, because the map
   colours from feature properties and cannot reach into a nested object. */
const geo = {
  type: "FeatureCollection",
  features: communities.map((c) => {
    const props = { id: c.id, name: c.common ?? titleCase(c.name), official: c.name };
    for (const p of PERIODS) {
      const v = c.periods[p.id];
      props["psf_" + p.id] = v?.psf ?? null;
      props["growth_" + p.id] = v?.growth ?? null;
      props["sales_" + p.id] = v?.sales ?? null;
      props["offplan_" + p.id] = v?.psf != null ? v.offplan : null;
      props["financed_" + p.id] = v?.psf != null ? v.financed : null;
    }
    return { type: "Feature", id: Number(c.id), properties: props,
             geometry: { type: "Polygon", coordinates: c.rings } };
  }),
};
writeFileSync("public/communities.geojson", JSON.stringify(geo));
console.log(`public/communities.geojson  ${(readFileSync("public/communities.geojson").length/1024).toFixed(0)} KB`);

const detail = Object.fromEntries(
  communities
    .filter((c) => PERIODS.some((p) => c.periods[p.id]?.psf != null))
    .map((c) => [c.id, {
      recent: c.recent,
      periods: Object.fromEntries(PERIODS.map((p) => [p.id, c.periods[p.id]
        ? { typical: c.periods[p.id].typical, projects: c.periods[p.id].projects }
        : null])),
    }]),
);
writeFileSync("public/areas.json", JSON.stringify({
  latest,
  periods: PERIODS.map(({ id, label }) => ({ id, label })),
  detail,
}));
console.log(`public/areas.json           ${(readFileSync("public/areas.json").length/1024).toFixed(0)} KB`);

/* Market-wide figures, pooled across every mapped community.
   The page quotes these as its opening answer, and an answer that cannot say
   how many sales it rests on is the kind this site exists to replace. Pooling
   references rather than copying rows: these arrays already exist. */
const pooled = { sales: [], mortgages: [], recent: [] };
for (const c of communities) {
  const s = stats.get(c.id);
  if (!s) continue;
  pooled.sales.push(...s.sales);
  pooled.mortgages.push(...s.mortgages);
}
const summary = {};
for (const p of PERIODS) {
  const v = periodStats(pooled, p.days);
  summary[p.id] = v && {
    psf: v.psf, growth: v.growth, sales: v.sales,
    offplan: v.offplan, financed: v.financed,
    reportable: communities.filter((c) => c.periods[p.id]?.psf != null).length,
  };
}

const withData = communities.filter((c) => c.periods["12m"]?.psf != null).length;
writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  latest,
  /* §4.7: every figure on the site traces back to this line. It was missing,
     and the page rendered "Source: ." for it. */
  source: "Dubai Land Department transaction register, via Dubai Pulse open data",
  totalSales: pooled.sales.length,
  summary,
  communities,
}));
const kb = (readFileSync(OUT).length / 1024).toFixed(0);
console.log(`${communities.length} communities, ${withData} with 12-month price data`);
for (const p of PERIODS) {
  const n = communities.filter((c) => c.periods[p.id]?.psf != null).length;
  console.log(`   ${p.label.padEnd(14)} ${n} communities reportable`);
}
console.log(`points after simplify: ${communities.reduce((n, c) => n + c.rings.flat().length, 0).toLocaleString()}`);
console.log(`${OUT}  ${kb} KB`);
