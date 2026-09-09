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
const stats = new Map();
const get = (m) => {
  if (!stats.has(m)) {
    stats.set(m, {
      psf: [], psfOld: [], sales: 0, sales12: 0, offplan: 0, mortgages: 0,
      /* Last twelve months only. An investor is asking what the market is doing
         now, not what it did in 2021. */
      recent: [], byRooms: new Map(), projects: new Map(), prices12: [],
    });
  }
  return stats.get(m);
};

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
    const date = cells[ix["instance_date"]] ?? "";
    if (group === "Mortgages") { s.mortgages++; continue; }
    if (group !== "Sales") continue;
    s.sales++;
    const offplan = cells[ix["reg_type_en"]] === "Off-Plan Properties";
    if (offplan) s.offplan++;

    if (new Date(date) >= cut12) {
      s.sales12++;
      const worth = Number(cells[ix["actual_worth"]]);
      const sqm = Number(cells[ix["procedure_area"]]);
      const rooms = (cells[ix["rooms_en"]] ?? "").trim();
      const project = (cells[ix["project_name_en"]] ?? "").trim();
      const sqft = sqm > 0 ? Math.round(sqm * 10.7639) : null;

      if (worth > 0) s.prices12.push(worth);

      /* Enough to show the last handful without carrying a year of rows into
         the browser. Kept sorted by date, trimmed as we go. */
      if (worth > 0 && sqft) {
        s.recent.push({ d: date.slice(0, 10), r: rooms || null, ft: sqft, w: Math.round(worth), o: offplan ? 1 : 0 });
        if (s.recent.length > 400) {
          s.recent.sort((a, b) => (a.d < b.d ? 1 : -1));
          s.recent.length = 40;
        }
      }
      /* What a given budget actually buys here, by bedroom count.
         Residential only: the record also carries Shop, Office and Land, and
         picking the dearest thing within budget kept landing on a retail unit,
         which is not what someone asking "what does 5m buy" means. */
      if (RESIDENTIAL.test(rooms) && worth > 0 && sqft) {
        if (!s.byRooms.has(rooms)) s.byRooms.set(rooms, { w: [], ft: [] });
        const b = s.byRooms.get(rooms);
        b.w.push(worth); b.ft.push(sqft);
      }
      if (project) s.projects.set(project, (s.projects.get(project) ?? 0) + 1);
    }
    if (date > latest) latest = date.slice(0, 10);
    const psm = Number(cells[ix["meter_sale_price"]]);
    if (psm > 1000 && psm < 200000) {
      const year = date.slice(0, 4);
      if (year >= "2023") s.psf.push(psm / 10.7639);
      else if (year >= "2020" && year <= "2022") s.psfOld.push(psm / 10.7639);
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

const titleCase = (s) => s.trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

/* ---------- assemble ---------- */
const communities = [];
for (const [num, poly] of polys) {
  // Hatta sits 80km east and would squash the city into a corner.
  const maxLon = Math.max(...poly.rings.flat().map((p) => p[0]));
  if (maxLon > 55.75) continue;
  const s = stats.get(num);
  const psf = median(s?.psf ?? []);
  const prices = (s?.prices12 ?? []).sort((a, b) => a - b);
  /* How many of the last year's sales landed at or under each budget. This is
     the answer to "can I actually buy here", and it doubles as a liquidity
     signal: a place with three sales in your range is not a market. */
  const BUDGETS = [1e6, 2e6, 3e6, 5e6, 8e6, 15e6];
  const reach = BUDGETS.map((b) => prices.filter((p) => p <= b).length);
  const rooms = [...(s?.byRooms ?? new Map())]
    .map(([label, v]) => ({
      rooms: label,
      n: v.w.length,
      price: Math.round(median(v.w)),
      sqft: Math.round(median(v.ft)),
    }))
    .filter((r) => r.n >= 5)
    .sort((a, b) => a.price - b.price);
  const projects = [...(s?.projects ?? new Map())]
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, n]) => ({ name, n }));
  const psfOld = median(s?.psfOld ?? []);
  const enough = (s?.psf.length ?? 0) >= 40;
  communities.push({
    id: num,
    name: poly.name,
    common: COMMON[poly.name] ?? null,
    rings: poly.rings.map((r) => simplify(r, 0.0004).map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)])),
    psf: enough ? Math.round(psf) : null,
    growth: enough && psfOld ? +(((psf - psfOld) / psfOld) * 100).toFixed(1) : null,
    sales: s?.sales ?? 0,
    sales12: s?.sales12 ?? 0,
    offplan: s?.sales ? Math.round((s.offplan / s.sales) * 100) : null,
    financed: s?.sales ? Math.round((s.mortgages / s.sales) * 100) : null,
    reach,
    rooms,
    projects,
    recent: (s?.recent ?? []).sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 8),
  });
}

/* GeoJSON for the map library, written to public/ so it is fetched and cached
   rather than inlined into every page. */
const geo = {
  type: "FeatureCollection",
  features: communities.map((c) => ({
    type: "Feature",
    id: Number(c.id),
    properties: {
      id: c.id, name: c.common ?? titleCase(c.name), official: c.name,
      psf: c.psf, growth: c.growth, sales12: c.sales12,
      offplan: c.offplan, financed: c.financed,
      // One count per budget band, so the map can recolour without a fetch.
      r0: c.reach?.[0] ?? null, r1: c.reach?.[1] ?? null, r2: c.reach?.[2] ?? null,
      r3: c.reach?.[3] ?? null, r4: c.reach?.[4] ?? null, r5: c.reach?.[5] ?? null,
    },
    geometry: { type: "Polygon", coordinates: c.rings },
  })),
};
writeFileSync("public/communities.geojson", JSON.stringify(geo));

/* Panel detail lives in its own file, fetched once. Folding it into the GeoJSON
   would push the geometry every reader downloads past a quarter of a megabyte
   for data most of them will never open. */
const detail = Object.fromEntries(communities.filter((c) => c.psf !== null).map((c) => [c.id, {
  reach: c.reach, rooms: c.rooms, projects: c.projects, recent: c.recent,
}]));
writeFileSync("public/areas.json", JSON.stringify({ latest, budgets: [1e6, 2e6, 3e6, 5e6, 8e6, 15e6], detail }));
console.log(`public/areas.json           ${(readFileSync("public/areas.json").length/1024).toFixed(0)} KB`);
console.log(`public/communities.geojson  ${(readFileSync("public/communities.geojson").length/1024).toFixed(0)} KB`);

const withData = communities.filter((c) => c.psf !== null).length;
writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  /* The date of the newest transaction, which is what a reader actually wants
     to know. "Compiled today" says nothing about how current the record is. */
  latest,
  budgets: [1e6, 2e6, 3e6, 5e6, 8e6, 15e6],
  source: "Dubai Land Department registered transactions; Dubai Municipality community boundaries",
  communities,
}));
const kb = (readFileSync(OUT).length / 1024).toFixed(0);
console.log(`${communities.length} communities, ${withData} with price data`);
console.log(`points after simplify: ${communities.reduce((n, c) => n + c.rings.flat().length, 0).toLocaleString()}`);
console.log(`${OUT}  ${kb} KB`);
