/**
 * Single source of truth for this site. Nothing here is hardcoded in a
 * component. (CLAUDE.md §6.1)
 */
export default {
  brand: "Property Desk",
  domain: "propertydeskdubai.com",
  tagline: "What buying in Dubai actually costs.",
  description:
    "Every fee on a Dubai property purchase, itemised, with the cash you need on transfer day. Sourced and dated.",
  /** Contact and analytics are set per site before launch, never committed. */
  contactEmail: "",
  gaMeasurementId: "",
  clarityProjectId: "",
  og: { image: "/og.png", width: 1200, height: 630 },
} as const;
