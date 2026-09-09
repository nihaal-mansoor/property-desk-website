/**
 * Consent-gated analytics. (CLAUDE.md §4.6)
 *
 * Nothing loads before opt-in and nothing loads before window `load`. Analytics
 * must never contend with the page for bandwidth — the CWV budget in §4.1
 * assumes this.
 *
 * Returns a script string to be injected with a CSP nonce. It is deliberately
 * dependency-free and small enough to inline.
 */
export const CONSENT_STORAGE_KEY = "uaeprop.consent.v1";
/**
 * Bootstrap: sets Consent Mode v2 defaults to `denied` BEFORE any tag loads,
 * then loads GA4 and Clarity only if prior consent is stored. Must be inlined
 * in <head> with a nonce so the denied default is registered first.
 */
export function consentBootstrapScript(config) {
    const { ga4MeasurementId: ga4, clarityProjectId: clarity } = config.analytics;
    return `
(function () {
  var KEY = ${JSON.stringify(CONSENT_STORAGE_KEY)};
  var GA = ${JSON.stringify(ga4)};
  var CLARITY = ${JSON.stringify(clarity)};

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2 — everything denied until the reader opts in.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  function granted() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw).analytics === true : false;
    } catch (e) { return false; }
  }

  function loadScript(src, attrs) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    if (attrs) for (var k in attrs) s.setAttribute(k, attrs[k]);
    document.head.appendChild(s);
  }

  function start() {
    if (!granted()) return;
    gtag('consent', 'update', { analytics_storage: 'granted' });

    if (GA) {
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA);
      gtag('js', new Date());
      gtag('config', GA, { send_page_view: true, anonymize_ip: true });
    }
    if (CLARITY) {
      window.clarity = window.clarity || function () {
        (window.clarity.q = window.clarity.q || []).push(arguments);
      };
      loadScript('https://www.clarity.ms/tag/' + CLARITY);
    }
  }

  // After load, so analytics never competes with the page itself.
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', function () { setTimeout(start, 0); });

  window.__uaepropConsent = {
    grant: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          analytics: true, decidedAt: new Date().toISOString()
        }));
      } catch (e) {}
      start();
    },
    deny: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          analytics: false, decidedAt: new Date().toISOString()
        }));
      } catch (e) {}
    },
    decided: function () {
      try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; }
    }
  };
})();`.trim();
}
/**
 * Conversion events are fired SERVER-SIDE on validated submission (§4.6), so
 * there is no client-side conversion tracking here by design. This helper is
 * for interaction events only — calculator used, WhatsApp clicked.
 */
export function trackEvent(name, params = {}) {
    const w = window;
    if (typeof w.gtag === "function")
        w.gtag("event", name, params);
}
//# sourceMappingURL=index.js.map