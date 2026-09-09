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
    /* The basemap has to follow the reader's theme, or a dark panel ends up
       sitting on a white map, which is what happens when you theme your own
       chrome and forget the thing underneath it. The ramp inverts with it,
       because pale blues disappear against a dark ground. */
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches &&
      document.documentElement.dataset.theme !== "light";
    const RAMP = dark
      ? ["#16232F","#1D3549","#264866","#305D84","#3B73A3","#4A8CC2","#63A6DA","#8CC4EC"]
      : ["#EAF0F7","#CBDCEC","#A3C2DD","#75A3CA","#4A82B4","#2A5F94","#14406B","#0B2A48"];
    const NODATA = dark ? "#232A31" : "#D9DEE4";
    /* Metric names are the stem; the period is appended to reach the property,
       so "psf" over three years reads psf_3y on the feature. */
    const LABEL = {
      psf: "Median AED per sqft",
      growth: "Change against the previous equal period",
      sales12: "Sales registered",
      offplan: "Share of sales that were off-plan",
      financed: "Mortgages registered per 100 sales",
    };
    const STEM = { psf: "psf", growth: "growth", sales12: "sales", offplan: "offplan", financed: "financed" };
    const periodLabel = () => (periods.find((p) => p.id === period)?.label ?? "").toLowerCase();

    let features = [];
  let detail = {};
  let periods = [];
  let period = "12m";
  let selectedId = null;  // sticky: only a click changes it
  let compare = [];       // up to three, compared below the map
  let metric = "psf";
  const AED = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0, notation: "compact" });

    const map = new Map({
      container: "map",
      style: dark
        ? "https://tiles.openfreemap.org/styles/dark"
        : "https://tiles.openfreemap.org/styles/positron",
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
      const key = STEM[m] + "_" + period;
      const expr = ramp(key);
      if (!expr) return;
      map.setPaintProperty("communities", "fill-color",
        ["case", ["==", ["get", key], null], NODATA, expr]);
      const n = document.getElementById("legend-note");
      if (n) n.textContent = LABEL[m] + ", " + periodLabel() + ". Grey: too few sales to report.";
    }

    function rowsHtml(rows) {
      return rows.map(([a, b]) =>
        '<div class="row"><span class="row-label">' + a + '</span>' +
        '<span class="row-value">' + b + '</span></div>').join("");
    }

    /* Developers register the same project under whatever casing they typed, so
       one area lists "AZIZI VENICE 14" next to "azizi venice 13". Normalised for
       display only; the register's own spelling is what we matched on.
       Roman numerals and short tokens are left alone so "DIFC" and "JVC" survive. */
    function projectName(raw) {
      return String(raw).trim().toLowerCase().replace(/[^\s\/-]+/g, (w) =>
        /^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
      );
    }

    function fillDetail(id) {
      const d = detail[id];
      const pd = d?.periods?.[period] ?? null;
      const recent = document.getElementById("p-recent");
      const projects = document.getElementById("p-projects");
      const answer = document.getElementById("p-typical");

      if (!d) {
        if (recent) recent.innerHTML = '<p class="meta" style="margin:0">Too few sales here to report.</p>';
        if (projects) projects.innerHTML = "";
        if (answer) answer.hidden = true;
        return;
      }
      if (answer) answer.hidden = false;

      if (recent) {
        recent.innerHTML = rowsHtml(d.recent.map((t) => [
          t.d.slice(8) + "/" + t.d.slice(5, 7) + " &middot; " + (t.r || "Not stated") +
            '<span class="row-note">' + t.ft.toLocaleString("en-AE") + " sqft" +
            (t.o ? " &middot; off-plan" : "") + "</span>",
          AED.format(t.w),
        ]));
      }

      if (projects) {
        /* Names only. A project is not a page and not a link: this reports what
           has traded, never what is for sale. */
        const list = pd?.projects ?? [];
        projects.innerHTML = list.length
          ? rowsHtml(list.map((p) => [projectName(p.name), fmt.format(p.n) + " sales"]))
          : '<p class="meta" style="margin:0">No named project activity in this period.</p>';
      }

      /* The typical sale over the chosen window: a sentence rather than a ratio. */
      if (answer) {
        const t = pd?.typical;
        const head = document.getElementById("p-typical-head");
        const line = document.getElementById("p-typical-line");
        const price = document.getElementById("p-typical-price");
        if (head) head.textContent = "Typical sale, " + periodLabel();
        if (line) line.textContent = t
          ? t.rooms + ", about " + t.sqft.toLocaleString("en-AE") + " sqft"
          : "Too few sales in this period to say";
        if (price) price.textContent = t
          ? "Median " + AED.format(t.price) + ", from " + t.n.toLocaleString("en-AE") + " sales"
          : "";
      }
    }

    /* Hide and show the rail. The button is revealed here rather than in the
       markup because without this script there is no way to bring the panel
       back, and a control that only works one way is worse than none. */
    /* The rail covers the left quarter of the canvas, so the city has to be
       framed into what is left of it or half of Dubai sits behind the panel.
       Kept here so hiding the rail can re-frame into the width it gives back. */
    let bounds = null;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function frame(animate) {
      if (!bounds) return;
      const panel = document.getElementById("map-panel");
      /* Only an overlapping rail steals width. Below 48rem it sits under the
         map and getComputedStyle reports static. */
      const overlaps = panelOpen && panel && getComputedStyle(panel).position === "absolute";
      map.fitBounds(bounds, {
        padding: {
          top: 40, right: 40, bottom: 40,
          left: 40 + (overlaps ? panel.getBoundingClientRect().width : 0),
        },
        duration: animate && !reduceMotion ? 300 : 0,
      });
    }

    const shell = document.querySelector(".map-full");
    const toggle = document.getElementById("p-toggle");
    let panelOpen = true;
    /* Kept so the show button can name what was clicked while hidden. A click
       that appears to do nothing reads as a broken map. */
    let lastName = "";

    function paintToggle() {
      if (!toggle) return;
      toggle.setAttribute("aria-expanded", String(panelOpen));
      toggle.textContent = panelOpen
        ? "Hide panel"
        : lastName ? "Show " + lastName : "Show panel";
    }

    function setPanel(open) {
      panelOpen = open;
      if (shell) shell.classList.toggle("panel-off", !open);
      paintToggle();
      frame(true);
    }

    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener("click", () => setPanel(!panelOpen));
      paintToggle();
    }

    function markSelected(id) {
      if (selectedId !== null) map.setFeatureState({ source: "communities", id: selectedId }, { selected: false });
      selectedId = id ?? null;
      if (selectedId !== null) map.setFeatureState({ source: "communities", id: selectedId }, { selected: true });
    }

    function clearSelection() {
      markSelected(null);
      lastName = "";
      paintToggle();
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
      const g = (stem) => p[stem + "_" + period];
      set("p-psf", g("psf") != null ? fmt.format(g("psf")) : "n/a");
      set("p-growth", g("growth") != null ? (g("growth") > 0 ? "+" : "") + g("growth") + "%" : "n/a");
      set("p-sales12", fmt.format(g("sales") ?? 0));
      set("p-offplan", g("offplan") != null ? g("offplan") + "%" : "n/a");
      set("p-financed", g("financed") != null ? g("financed") + "%" : "n/a");
      const sl = document.getElementById("p-sales-label");
      if (sl) sl.childNodes[0].nodeValue = "Sales, " + periodLabel();
      const liq = document.getElementById("p-liquidity-note");
      if (liq) {
        const n = p["sales_" + period] ?? 0;
        liq.textContent = n < 50
          ? "Thin. Selling again here may take time."
          : n < 300 ? "Moderate turnover." : "Actively traded.";
      }
      fillDetail(p.id);
      markSelected(id);
      lastName = p.name;
      paintToggle();
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
      periods = areas.periods;
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
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], dark ? "#FFFFFF" : "#0E1116",
            dark ? "#0B0D10" : "#FFFFFF",
          ],
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
      bounds = [[west, south], [east, north]];
      frame(false);

      /* Fill in the area the server rendered. A full-height rail makes the
         gap obvious: "Projects trading here" and "Latest registered sales"
         were bare headings until the first click, because only select() ever
         called this. */
      const initial = document.getElementById("p-name")?.dataset.id;
      if (initial) fillDetail(initial);

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
          const v = p[STEM[metric] + "_" + period];
          const headline = v == null ? "too few sales"
            : metric === "psf" ? fmt.format(v) + " /sqft"
            : metric === "growth" ? (v > 0 ? "+" : "") + v + "%"
            : metric === "sales12" ? fmt.format(v) + " sales"
            : v + "%";
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

      const g = (c, stem) => c[stem + "_" + period];
      const rows = [
        ["Typical sale", (c) => {
          const t = detail[c.id]?.periods?.[period]?.typical;
          return t ? t.rooms + ", " + t.sqft.toLocaleString("en-AE") + " sqft" : "n/a";
        }],
        ["Median price", (c) => {
          const t = detail[c.id]?.periods?.[period]?.typical;
          return t ? AED.format(t.price) : "n/a";
        }],
        ["Median AED/sqft", (c) => (g(c, "psf") != null ? fmt.format(g(c, "psf")) : "n/a")],
        ["Price growth", (c) => (g(c, "growth") != null ? (g(c, "growth") > 0 ? "+" : "") + g(c, "growth") + "%" : "n/a")],
        ["Sales", (c) => (g(c, "sales") ?? 0).toLocaleString("en-AE")],
        ["Off-plan share", (c) => (g(c, "offplan") != null ? g(c, "offplan") + "%" : "n/a")],
        ["Financed share", (c) => (g(c, "financed") != null ? g(c, "financed") + "%" : "n/a")],
      ];
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

      if (note) note.textContent = "Compared over the " + periodLabel() + ". Change the period above and these update.";
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

    document.querySelectorAll("[data-metric]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-metric]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)));
        paint(btn.dataset.metric);
      });
    });

    document.querySelectorAll("[data-period]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-period]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)));
        period = btn.dataset.period;
        paint(metric);
        const sel = document.getElementById("p-name")?.dataset.id;
        if (sel) {
          fillDetail(sel);
          const f = features.find((x) => x.properties.id === sel);
          if (f) select(f.properties, f.id);
        }
        renderCompare();
      });
    });
  }
`;

export const GET: APIRoute = () =>
  new Response(JS, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
