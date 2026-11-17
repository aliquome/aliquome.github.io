// Routing on clean paths (/db/gnomad/, /models/chembfn/, …; see domain/paths.js).
// Pages still write links as routes ("#source/gnomad"): the shell turns every
// such link into its path as it appears, and follows clicks on the site's own
// links without reloading. Old "#…" addresses are moved to their paths.
import { stopPage } from "../core/lifecycle.js";
import { view } from "../core/dom.js";
import { setNavigator } from "../core/nav.js";
import { toPath, fromPath, isRouteHash } from "../domain/paths.js";
import { armArt } from "../ui/art.js";
import { palette } from "../core/search.js";
import { pageHome } from "../pages/home.js";
import { pageSources, pageSource } from "../pages/sources.js";
import { pageDatasets } from "../pages/datasets.js";
import { pageLatest, pagePapers } from "../pages/papers.js";
import { pageBenchmarks } from "../pages/benchmarks.js";
import { pageStatus } from "../pages/status.js";
import { pageAbout } from "../pages/about.js";
import { pageSaved } from "../pages/saved.js";
import { notFound } from "../pages/not-found.js";

const HOME_TITLE = "Aliquome: versioned bioinformatics databases, datasets and benchmarks";
let routeKey = "";
// The page the visitor landed on keeps the title written for it (and read by
// search engines); pages reached by a click get "<heading> | Aliquome".
let landing = null, landingTitle = "";

export const currentRoute = () => fromPath(location.pathname, location.search);

export function route() {
  stopPage();
  view.onclick = null;
  palette.close();
  const r = currentRoute();
  const [page, a, b] = r || ["notfound"];
  routeKey = page;
  const nav = { source: "sources", latest: "papers" }[page] || page;
  document.querySelectorAll(".nav a").forEach((x) => (x.dataset.nav === nav ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current")));
  const pages = { home: pageHome, latest: () => pageLatest(a, b), saved: pageSaved, sources: () => pageSources(a), source: () => pageSource(a), datasets: () => pageDatasets(a, b),
    papers: () => pagePapers(a), benchmarks: () => pageBenchmarks(a, b), status: pageStatus, about: pageAbout };
  const render = pages[page] || (() => notFound("That page does not exist."));
  const go = () => { render(); armArt(); syncHead(); window.scrollTo({ top: 0, behavior: "instant" }); };
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // A quick second navigation skips the running transition; the page still
    // updates, so the skipped transition's rejections are expected.
    const t = document.startViewTransition(go);
    for (const p of [t.ready, t.finished, t.updateCallbackDone]) p?.catch(() => {});
  } else go();
}

// Go to a route ("source/gnomad") or a path ("/db/gnomad/").
export function navigate(target, { replace = false } = {}) {
  const url = String(target).startsWith("/") ? String(target) : toPath(target);
  if (!url) return;
  try { history[replace ? "replaceState" : "pushState"](null, "", url); } catch { location.assign(url); return; }
  route();
}

// Title and canonical address follow the page shown.
function syncHead() {
  const h1 = view.querySelector("h1")?.textContent.replace(/\s+/g, " ").trim();
  const title = location.pathname + location.search === landing ? landingTitle : routeKey === "home" || !h1 ? HOME_TITLE : `${h1} | Aliquome`;
  if (document.title !== title) document.title = title;
  const canon = document.querySelector('link[rel="canonical"]');
  if (canon) canon.href = location.origin + location.pathname;
}

const fixLink = (a) => {
  const h = a.getAttribute("href");
  if (h && h[0] === "#" && isRouteHash(h)) { const p = toPath(h); if (p) a.setAttribute("href", p); }
};
const fixLinks = (node) => {
  if (node.nodeType !== 1) return;
  if (node.matches('a[href^="#"]')) fixLink(node);
  node.querySelectorAll('a[href^="#"]').forEach(fixLink);
};

// The address of an internal link, or null for anything the browser should handle.
function internalUrl(a) {
  if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return null;
  const h = a.getAttribute("href") || "";
  if (h[0] === "#") return isRouteHash(h) ? toPath(h) : null;
  let u;
  try { u = new URL(a.href, location.href); } catch { return null; }
  if (u.origin !== location.origin || !fromPath(u.pathname, u.search)) return null;
  return u.pathname + u.search;
}

// An old "#source/gnomad" address becomes "/db/gnomad/"; true when one was moved.
export function adoptLegacyHash() {
  if (!isRouteHash(location.hash)) return false;
  const url = toPath(location.hash);
  if (!url) return false;
  try { history.replaceState(null, "", url); } catch { return false; }
  return true;
}

export function startRouting() {
  setNavigator(navigate);
  // 404.html and other pages kept out of search have no title worth keeping
  const written = !document.querySelector('meta[name="robots"][content*="noindex"]');
  if (!adoptLegacyHash() && currentRoute() && written) { landing = location.pathname + location.search; landingTitle = document.title; }
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", () => { if (adoptLegacyHash()) route(); });
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    const url = a && internalUrl(a);
    if (!url) return;
    e.preventDefault();
    navigate(url);
  });
  fixLinks(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "attributes") fixLinks(m.target);
      else m.addedNodes.forEach(fixLinks);
    }
    syncHead();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
}
