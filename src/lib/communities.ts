/**
 * One source of truth for which communities get a page, what they are called
 * and what they live at.
 *
 * The home page table and the community pages both read from here so the two
 * can never disagree about a name or a URL, which is the failure mode that
 * produces a table row linking to a 404.
 */
import map from "../data/map.json";

export type Period = "12m" | "3y" | "5y" | "10y";
export const PERIODS: readonly Period[] = ["12m", "3y", "5y", "10y"] as const;

/** How each window reads in a sentence, so prose is never assembled by hand. */
export const PERIOD_PHRASE: Record<Period, string> = {
  "12m": "the last twelve months",
  "3y": "the last three years",
  "5y": "the last five years",
  "10y": "the last ten years",
};
export const PERIOD_SHORT: Record<Period, string> = {
  "12m": "12 months",
  "3y": "3 years",
  "5y": "5 years",
  "10y": "10 years",
};

export type Community = (typeof map.communities)[number];
export type Figures = {
  psf: number | null;
  growth: number | null;
  sales: number;
  offplan: number;
  financed: number;
  typical?: { rooms: string; price: number; sqft: number; n: number } | null;
  projects?: { name: string; n: number }[];
};

const all = map.communities as unknown as Community[];

export const figuresOf = (c: Community, p: Period): Figures | undefined =>
  (c.periods as Record<string, Figures>)[p];

/**
 * The same expansion the build script applies to the geojson labels, so the
 * map, the table and the page headings never disagree about a name.
 */
export function named(c: Community): string {
  return (
    c.common ??
    c.name
      .trim()
      .toLowerCase()
      .replace(/\bind\.\s*/g, "industrial ")
      .replace(/\b\w/g, (w) => w.toUpperCase())
  );
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * A page is worth publishing when the register can actually support one.
 *
 * Two ways to qualify: a community reported in the last twelve months, so the
 * home page table links to it and the link must land somewhere; or one with
 * real depth behind it even though it is quiet now. Below that floor a page
 * would be padding, and ninety pages of padding is the doorway-network
 * footprint §1.5 exists to avoid.
 */
const TEN_YEAR_SALES_FLOOR = 100;

function qualifies(c: Community): boolean {
  const current = figuresOf(c, "12m")?.psf != null;
  const deep = (figuresOf(c, "10y")?.sales ?? 0) >= TEN_YEAR_SALES_FLOOR;
  const everPriced = PERIODS.some((p) => figuresOf(c, p)?.psf != null);
  return everPriced && (current || deep);
}

/**
 * Slugs are assigned once over the whole set so a collision is resolved the
 * same way on every build. Two communities can share a common name (the DLD
 * calls one of them AL KHEERAN and everyone else calls it Ras Al Khor), and
 * the official name is unique, so it is the tie-breaker.
 */
function buildSlugs(list: Community[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const c of list) {
    const s = slugify(named(c));
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const c of list) {
    const base = slugify(named(c));
    let slug = base;
    if ((counts.get(base) ?? 0) > 1) slug = slugify(c.name);
    if (used.has(slug)) slug = `${slug}-${c.id}`;
    used.add(slug);
    out.set(c.id, slug);
  }
  return out;
}

/** Sorted by id so slug assignment is stable between builds. */
const selected = all.filter(qualifies).sort((a, b) => a.id.localeCompare(b.id));
const slugs = buildSlugs(selected);

export const slugOf = (c: Community): string => slugs.get(c.id) ?? slugify(named(c));
export const pathOf = (c: Community): string => `/areas/${slugOf(c)}`;

/** Every community that gets a page, dearest first on the current window. */
export const pageCommunities: readonly Community[] = [...selected].sort((a, b) => {
  const pa = figuresOf(a, "12m")?.psf ?? figuresOf(a, "10y")?.psf ?? 0;
  const pb = figuresOf(b, "12m")?.psf ?? figuresOf(b, "10y")?.psf ?? 0;
  return pb - pa;
});

const bySlugIndex = new Map(selected.map((c) => [slugOf(c), c]));
export const communityBySlug = (slug: string): Community | undefined => bySlugIndex.get(slug);

/** True when the home page table should link this row to a page. */
export const hasPage = (c: Community): boolean => bySlugIndex.has(slugOf(c)) && qualifies(c);

/** The most recent window this community can actually be reported on. */
export function freshestPeriod(c: Community): Period {
  return PERIODS.find((p) => figuresOf(c, p)?.psf != null) ?? "10y";
}

/**
 * Nearest neighbours by price on the given window, for onward links. Price is
 * the useful axis: someone reading about a community at AED 1,200 is weighing
 * it against the others at AED 1,200, not against the alphabet.
 */
export function comparables(c: Community, p: Period, n = 6): Community[] {
  const mine = figuresOf(c, p)?.psf;
  if (mine == null) return [];
  return pageCommunities
    .filter((o) => o.id !== c.id && figuresOf(o, p)?.psf != null)
    .sort(
      (a, b) =>
        Math.abs((figuresOf(a, p)!.psf as number) - mine) -
        Math.abs((figuresOf(b, p)!.psf as number) - mine),
    )
    .slice(0, n);
}

export const cityFigures = (p: Period): Figures =>
  (map as unknown as { summary: Record<string, Figures> }).summary[p];

export const meta = {
  latest: (map as unknown as { latest: string }).latest,
  source: (map as unknown as { source: string }).source,
  totalSales: (map as unknown as { totalSales: number }).totalSales,
  communityCount: all.length,
};

export const asOfLong = new Date(meta.latest).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * The register writes bedroom counts as "1 B/R". Spelled out for prose, and
 * for question text, which is the part a search engine matches on.
 */
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven"];
export function roomsPhrase(r: string): string {
  const m = /^(\d+)\s*b\/r$/i.exec(r.trim());
  return m ? `${WORDS[+m[1]] ?? m[1]}-bedroom` : r.trim().toLowerCase();
}

export const fmt = new Intl.NumberFormat("en-AE");
export const signed = (n: number): string => `${n > 0 ? "+" : ""}${n}`;
