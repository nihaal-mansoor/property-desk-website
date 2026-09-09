import type { APIRoute } from "astro";

/**
 * The map, served as a module file.
 *
 * Not an Astro <script>: Vite refuses to emit MapLibre's tile-decoder worker,
 * in dev and in the production build alike, so the map fetched its style and
 * sprites and then rendered nothing, with a 404 for maplibre-gl-worker.mjs as
 * the only clue. Serving MapLibre's own dist from /vendor and importing it here
 * lets the browser resolve the worker next to it, as MapLibre expects.
 *
 * The page underneath carries the full dataset as a table, so with no
 * JavaScript, or if the tile host is unreachable, every figure is still there.
 */
export const prerender = true;

const JS = String.raw`
  /* The prebuilt bundle above puts maplibregl on window and carries its own
     worker, which the ESM build does not. See scripts/vendor-maplibre.mjs. */
  import { Map, NavigationControl, AttributionControl, FullscreenControl } from "/vendor/maplibre-gl.mjs";

  /*
   * A real basemap with streets, coastline and place names, because a reader
   * cannot orient themselves on unlabelled polygons however well coloured.
   *
   * Two honest costs. MapLibre is far heavier than anything else on this site,
   * which is why nothing else here uses a library. And the tile host sees which
   * part of Dubai each visitor pans to, which the build-time SVG did not leak;
   * the privacy page says so.
   */
  const el = document.getElementById("map");
  if (el) {
    const fmt = new Intl.NumberFormat("en-AE");
    const RAMP = ["#EAF0F7","#CBDCEC","#A3C2DD","#75A3CA","#4A82B4","#2A5F94","#14406B","#0B2A48"];
    const NODATA = "#D9DEE4";
    const LABEL = {
      psf: "Median AED per sqft, sales since 2023",
      growth: "Change against 2020 to 2022",
      sales12: "Sales registered in the last 12 months",
      offplan: "Share of sales that were off-plan",
      financed: "Mortgages registered per 100 sales",
    };

    let features = [];
  let detail = {};
  let budgets = [];
  let budgetIdx = 0;      // 0 means "any"
  let selectedId = null;  // sticky: only a click changes it
  let compare = [];       // up to three, compared below the map
  let metric = "psf";
  const AED = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0, notation: "compact" });

    const map = new Map({
      container: "map",
      style: "https://tiles.openfreemap.org/styles/positron",
      // Overwritten by fitBounds once the data is in. A hardcoded centre framed
      // the view on Sharjah, because Dubai's built-up area is not in the middle
      // of Dubai's territory.
      center: [55.22, 25.08],
      zoom: 9.3,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new FullscreenControl(), "top-right");

    const firstSymbol = () => map.getStyle().layers.find((l) => l.type === "symbol")?.id;

    function ramp(metric) {
      const vals = features.map((f) => f.properties[metric])
        .filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
      if (!vals.length) return null;
      const out = ["interpolate", ["linear"], ["to-number", ["get", metric]]];
      RAMP.forEach((c, i) => out.push(vals[Math.floor((vals.length - 1) * i / (RAMP.length - 1))], c));
      return out;
    }

    function paint(m) {
      metric = m;
      /* With a budget chosen the map answers a different question: not what a
         place costs, but how much of it actually traded at your price. */
      const key = budgetIdx > 0 ? "r" + (budgetIdx - 1) : m;
      const expr = ramp(key);
      if (!expr) return;
      map.setPaintProperty("communities", "fill-color",
        ["case", ["==", ["get", key], null], NODATA, expr]);
      const n = document.getElementById("legend-note");
      if (n) {
        n.textContent = budgetIdx > 0
          ? "Sales at or under " + AED.format(budgets[budgetIdx - 1]) + " in the last 12 months. Darker means more of the market is within reach."
          : LABEL[m] + ". Grey: too few sales to report.";
      }
    }

    /* The biggest home the budget reaches, preferring the size that actually
       trades in volume over a thin outlier one notch larger. */
    function withinBudget(d, budget) {
      const within = d.rooms.filter((r) => r.price <= budget);
      if (!within.length) return null;
      const deepest = Math.max(...within.map((r) => r.n));
      const solid = within.filter((r) => r.n >= Math.max(5, deepest * 0.1));
      const best = (solid.length ? solid : within).slice(-1)[0];
      return best.rooms + ", about " + best.sqft.toLocaleString("en-AE") + " sqft";
    }

    function rowsHtml(rows) {
      return rows.map(([a, b]) =>
        '<div class="row"><span class="row-label">' + a + '</span>' +
        '<span class="row-value">' + b + '</span></div>').join("");
    }

    function fillDetail(id) {
      const d = detail[id];
      const recent = document.getElementById("p-recent");
      const projects = document.getElementById("p-projects");
      const answer = document.getElementById("p-budget");

      if (!d) {
        if (recent) recent.innerHTML = '<p class="meta" style="margin:0">Too few sales here to report.</p>';
        if (projects) projects.innerHTML = "";
        if (answer) answer.hidden = true;
        return;
      }

      if (recent) {
        recent.innerHTML = rowsHtml(d.recent.map((t) => [
          t.d.slice(8) + "/" + t.d.slice(5, 7) + " &middot; " + (t.r || "Not stated") +
            '<span class="row-note">' + t.ft.toLocaleString("en-AE") + " sqft" +
            (t.o ? " &middot; off-plan" : "") + "</span>",
          AED.format(t.w),
        ]));
      }
      if (projects) {
        /* Names only. A project is not a page and not a link: this says what
           has traded, never what is for sale. */
        projects.innerHTML = d.projects.length
          ? rowsHtml(d.projects.map((p) => [p.name, p.n + " sales"]))
          : '<p class="meta" style="margin:0">No named project activity in the last year.</p>';
      }

      /* What the chosen budget actually reaches here. */
      if (answer) {
        if (budgetIdx === 0) { answer.hidden = true; return; }
        const budget = budgets[budgetIdx - 1];
        const best = withinBudget(d, budget);
        const n = d.reach[budgetIdx - 1] ?? 0;
        answer.hidden = false;
        document.getElementById("p-budget-line").textContent =
          best ?? "Nothing typically trades at this budget here.";
        document.getElementById("p-budget-count").textContent = n
          ? n.toLocaleString("en-AE") + " sales at or under " + AED.format(budget) + " in the last 12 months."
          : "No sales at or under " + AED.format(budget) + " in the last 12 months.";
      }
    }

    function markSelected(id) {
      if (selectedId !== null) map.setFeatureState({ source: "communities", id: selectedId }, { selected: false });
      selectedId = id ?? null;
      if (selectedId !== null) map.setFeatureState({ source: "communities", id: selectedId }, { selected: true });
    }

    function clearSelection() {
      markSelected(null);
      const hint = document.getElementById("p-hint");
      if (hint) hint.textContent = "Click any area on the map";
      const btn = document.getElementById("p-compare");
      if (btn) btn.hidden = true;
    }

    function select(p, id) {
      const set = (id, v) => {
        const n = document.getElementById(id); if (n) n.textContent = v;
      };
      const nameEl = document.getElementById("p-name");
      if (nameEl) nameEl.dataset.id = p.id;
      set("p-name", p.name);
      set("p-official", p.official);
      set("p-psf", p.psf != null ? fmt.format(p.psf) : "n/a");
      set("p-growth", p.growth != null ? (p.growth > 0 ? "+" : "") + p.growth + "%" : "n/a");
      set("p-sales12", fmt.format(p.sales12 ?? 0));
      set("p-offplan", p.offplan != null ? p.offplan + "%" : "n/a");
      set("p-financed", p.financed != null ? p.financed + "%" : "n/a");
      const liq = document.getElementById("p-liquidity-note");
      if (liq) {
        const n = p.sales12 ?? 0;
        liq.textContent = n < 50
          ? "Thin. Selling again here may take time."
          : n < 300 ? "Moderate turnover." : "Actively traded.";
      }
      fillDetail(p.id);
      markSelected(id);
      const hint = document.getElementById("p-hint");
      if (hint) hint.textContent = "Selected";
      const btn = document.getElementById("p-compare");
      if (btn) {
        btn.hidden = false;
        btn.disabled = compare.some((c) => c.id === p.id) || compare.length >= 3;
        btn.textContent = compare.some((c) => c.id === p.id) ? "Added" : "Compare";
        btn.onclick = () => addCompare(p);
      }
    }

    map.on("load", async () => {
      const [geo, areas] = await Promise.all([
        fetch("/communities.geojson").then((r) => r.json()),
        fetch("/areas.json").then((r) => r.json()),
      ]);
      features = geo.features;
      detail = areas.detail;
      budgets = areas.budgets;
      map.addSource("communities", { type: "geojson", data: geo, promoteId: "id" });

      const before = firstSymbol();
      map.addLayer({
        id: "communities", type: "fill", source: "communities",
        paint: {
          "fill-color": NODATA,
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.9, 0.68],
        },
      }, before);
      map.addLayer({
        id: "communities-line", type: "line", source: "communities",
        paint: {
          "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#0E1116", "#FFFFFF"],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 2.6,
            ["boolean", ["feature-state", "hover"], false], 1.8,
            0.6,
          ],
        },
      }, before);

      paint("psf");

      /* Frame on the communities that actually have a market. Everything is
         drawn, but the empty desert does not get a vote on where to look. */
      const active = features.filter((f) => f.properties.psf !== null);
      let west = 180, south = 90, east = -180, north = -90;
      for (const f of active) {
        for (const ring of f.geometry.coordinates) {
          for (const [lon, lat] of ring) {
            if (lon < west) west = lon;
            if (lon > east) east = lon;
            if (lat < south) south = lat;
            if (lat > north) north = lat;
          }
        }
      }
      map.fitBounds([[west, south], [east, north]], { padding: 40, duration: 0 });

      /* Hover shows a label at the cursor and nothing else. The panel only
         changes on click, because a panel that follows the pointer can only be
         read while the pointer is still, and reading it means moving the
         pointer. */
      let hovered = null;
      const tip = document.getElementById("map-tip");

      map.on("mousemove", "communities", (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = "pointer";
        const f = e.features[0];
        if (hovered !== null && hovered !== f.id) {
          map.setFeatureState({ source: "communities", id: hovered }, { hover: false });
        }
        hovered = f.id;
        map.setFeatureState({ source: "communities", id: hovered }, { hover: true });
        if (tip) {
          const p = f.properties;
          const headline = budgetIdx > 0
            ? (p["r" + (budgetIdx - 1)] ?? 0).toLocaleString("en-AE") + " in range"
            : p.psf != null ? fmt.format(p.psf) + " /sqft" : "too few sales";
          tip.innerHTML = "<strong>" + p.name + "</strong><span>" + headline + "</span>";
          tip.hidden = false;
          tip.style.transform = "translate(" + (e.point.x + 14) + "px," + (e.point.y + 14) + "px)";
        }
      });
      map.on("mouseleave", "communities", () => {
        map.getCanvas().style.cursor = "";
        if (hovered !== null) map.setFeatureState({ source: "communities", id: hovered }, { hover: false });
        hovered = null;
        if (tip) tip.hidden = true;
      });
      map.on("click", "communities", (e) => {
        if (e.features?.length) select(e.features[0].properties, e.features[0].id);
      });
      /* Clicking the sea or empty desert clears, so there is a way out. */
      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["communities"] });
        if (!hits.length) clearSelection();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") clearSelection();
      });
    });

    function addCompare(p) {
      if (compare.some((c) => c.id === p.id) || compare.length >= 3) return;
      compare.push(p);
      renderCompare();
      const btn = document.getElementById("p-compare");
      if (btn) { btn.textContent = "Added"; btn.disabled = true; }
    }

    function renderCompare() {
      const section = document.getElementById("compare");
      const table = document.getElementById("compare-table");
      const note = document.getElementById("compare-note");
      if (!section || !table) return;
      section.hidden = compare.length === 0;
      if (!compare.length) return;

      const budget = budgetIdx > 0 ? budgets[budgetIdx - 1] : null;
      const rows = [
        ["Median AED/sqft", (c) => (c.psf != null ? fmt.format(c.psf) : "n/a")],
        ["Price growth", (c) => (c.growth != null ? (c.growth > 0 ? "+" : "") + c.growth + "%" : "n/a")],
        ["Sales, last 12 months", (c) => (c.sales12 ?? 0).toLocaleString("en-AE")],
        ["Off-plan share", (c) => (c.offplan != null ? c.offplan + "%" : "n/a")],
        ["Financed share", (c) => (c.financed != null ? c.financed + "%" : "n/a")],
      ];
      if (budget) {
        rows.unshift([
          "At " + AED.format(budget),
          (c) => {
            const d = detail[c.id];
            if (!d) return "n/a";
            return withinBudget(d, budget) ?? "out of reach";
          },
        ]);
        rows.splice(1, 0, [
          "Sales in range",
          (c) => ((detail[c.id]?.reach?.[budgetIdx - 1]) ?? 0).toLocaleString("en-AE"),
        ]);
      }

      table.innerHTML =
        "<thead><tr><th scope='col' class='cmp-h'></th>" +
        compare.map((c, i) =>
          "<th scope='col' class='cmp-h'>" + c.name +
          "<button type='button' class='cmp-x' data-i='" + i + "' aria-label='Remove " + c.name + "'>Remove</button></th>").join("") +
        "</tr></thead><tbody>" +
        rows.map(([label, fn]) =>
          "<tr><th scope='row' class='cmp-l'>" + label + "</th>" +
          compare.map((c) => "<td class='cmp-v num'>" + fn(c) + "</td>").join("") + "</tr>").join("") +
        "</tbody>";

      if (note) {
        note.textContent = budget
          ? "Compared at " + AED.format(budget) + ". Change the budget above and these update."
          : "Pick a budget above and these gain a row for what it buys in each.";
      }
      table.querySelectorAll(".cmp-x").forEach((b) => {
        b.addEventListener("click", () => {
          compare.splice(Number(b.dataset.i), 1);
          renderCompare();
          const cb = document.getElementById("p-compare");
          if (cb && selectedId !== null) { cb.disabled = compare.length >= 3; cb.textContent = "Compare"; }
        });
      });
    }

    document.getElementById("compare-clear")?.addEventListener("click", () => {
      compare = [];
      renderCompare();
      const cb = document.getElementById("p-compare");
      if (cb) { cb.disabled = false; cb.textContent = "Compare"; }
    });

    document.querySelectorAll(".metric[data-metric]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".metric[data-metric]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)));
        /* Choosing a metric means you are no longer asking the budget question. */
        budgetIdx = 0;
        document.querySelectorAll(".budget-btn").forEach((b, i) =>
          b.setAttribute("aria-pressed", String(i === 0)));
        paint(btn.dataset.metric);
      });
    });

    document.querySelectorAll(".budget-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".budget-btn").forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)));
        budgetIdx = Number(btn.dataset.budget);
        paint(metric);
        const sel = document.getElementById("p-name")?.dataset.id;
        if (sel) fillDetail(sel);
        renderCompare();
      });
    });
  }
`;

export const GET: APIRoute = () =>
  new Response(JS, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
