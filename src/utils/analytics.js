// Fires a GA4 pageview for the given path. The base gtag.js snippet lives in index.html with
// send_page_view disabled -- this is the single source of truth for every pageview (the first
// one included), since a client-side-routed SPA only gets one real page load per session.
export function trackPageview(path, title) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });
}
