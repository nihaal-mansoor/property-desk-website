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

    function paint(metric) {
      const expr = ramp(metric);
      if (!expr) return;
      map.setPaintProperty("communities", "fill-color",
        ["case", ["==", ["get", metric], null], NODATA, expr]);
      const n = document.getElementById("legend-note");
      if (n) n.textContent = LABEL[metric] + ". Grey: too few sales to report.";
    }

    function select(p) {
      const set = (id, v) => {
        const n = document.getElementById(id); if (n) n.textContent = v;
      };
      set("p-name", p.name);
      set("p-official", p.official);
      set("p-psf", p.psf != null ? fmt.format(p.psf) : "—");
      set("p-growth", p.growth != null ? (p.growth > 0 ? "+" : "") + p.growth + "%" : "—");
      set("p-sales12", fmt.format(p.sales12 ?? 0));
      set("p-offplan", p.offplan != null ? p.offplan + "%" : "—");
      set("p-financed", p.financed != null ? p.financed + "%" : "—");
    }

    map.on("load", async () => {
      const geo = await (await fetch("/communities.geojson")).json();
      features = geo.features;
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
          "line-color": "#FFFFFF",
          "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.4, 0.6],
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

      let hovered = null;
      map.on("mousemove", "communities", (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = "pointer";
        if (hovered !== null) map.setFeatureState({ source: "communities", id: hovered }, { hover: false });
        hovered = e.features[0].id;
        map.setFeatureState({ source: "communities", id: hovered }, { hover: true });
        select(e.features[0].properties);
      });
      map.on("mouseleave", "communities", () => {
        map.getCanvas().style.cursor = "";
        if (hovered !== null) map.setFeatureState({ source: "communities", id: hovered }, { hover: false });
        hovered = null;
      });
      map.on("click", "communities", (e) => {
        if (e.features?.length) select(e.features[0].properties);
      });
    });

    document.querySelectorAll(".metric").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".metric").forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)));
        paint(btn.dataset.metric);
      });
    });
  }
`;

export const GET: APIRoute = () =>
  new Response(JS, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
