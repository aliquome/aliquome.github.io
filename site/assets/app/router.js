// Hash routes: #home, #sources[/field], #source/<id>, #datasets[/field[/name]],
// #latest|#papers[/field], #benchmarks[/...], #status, #about, #saved.
import { stopPage } from "../core/lifecycle.js";
import { view } from "../core/dom.js";
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

export function route() {
  stopPage();
  view.onclick = null;
  palette.close();
  const [page, a, b] = decodeURIComponent(location.hash.replace(/^#/, "") || "home").split("/");
  const nav = { source: "sources", latest: "papers" }[page] || page;
  document.querySelectorAll(".nav a").forEach((x) => (x.dataset.nav === nav ? x.setAttribute("aria-current", "page") : x.removeAttribute("aria-current")));
  const pages = { home: pageHome, latest: () => pageLatest(a, b), saved: pageSaved, sources: () => pageSources(a), source: () => pageSource(a), datasets: () => pageDatasets(a, b),
    papers: () => pagePapers(a), benchmarks: () => pageBenchmarks(a, b), status: pageStatus, about: pageAbout };
  const render = pages[page] || (() => notFound("That page does not exist."));
  const go = () => { render(); armArt(); window.scrollTo({ top: 0, behavior: "instant" }); };
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go);
  else go();
}
