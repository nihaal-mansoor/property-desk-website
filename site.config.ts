/**
 * Single source of truth for this site. Nothing here is hardcoded in a
 * component. (CLAUDE.md §6.1)
 */
export default {
  brand: "Property Desk",
  domain: "propertydeskdubai.com",
  tagline: "What Dubai property actually sold for.",
  description:
    "Every Dubai community, coloured by the registered sale record rather than by asking prices. Built from 1.78 million Land Department transactions.",
  /** Contact and analytics are set per site before launch, never committed. */
  contactEmail: "",
  gaMeasurementId: "",
  clarityProjectId: "",
  og: { image: "/og.png", width: 1200, height: 630 },
} as const;
