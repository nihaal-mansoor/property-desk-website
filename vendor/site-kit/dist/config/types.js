/**
 * The single source of truth for a site's identity. Never hardcode any of these
 * values in a component — import the config. (CLAUDE.md §6.1)
 */
/** Identity helper that gives editor completion and type checking on site.config.ts. */
export function defineSiteConfig(config) {
    return config;
}
/**
 * Portfolio-wide contact defaults.
 *
 * Deliberately blank. These repositories are public, so a personal address or
 * number must never be committed here. Set real values per site in that site's
 * environment, and prefer a role address on the site's own domain over a
 * personal one.
 */
export const DEFAULT_CONTACT = {
    whatsapp: "",
    email: "",
};
/** Canonical origin for a site, no trailing slash. */
export function originOf(config) {
    return `https://${config.domain}`;
}
//# sourceMappingURL=types.js.map