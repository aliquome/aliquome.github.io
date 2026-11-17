// Pinomics: entry point. Layers, from the bottom up:
//   domain/   pure logic (links, ranking, formatting), no DOM
//   core/     data store, catalogue lookups, DOM helpers, search
//   app/      router and theme, on top of the pages
//   services/ sign-in and submissions API, saved items
//   ui/       reusable pieces of markup
//   features/ the suggestion panel
//   pages/    one module per route
//   visuals/  3D figures and the cell animation
import { view, esc } from "./core/dom.js";
import { S, need, needTables, load } from "./core/store.js";
import { prettyDate } from "./domain/format.js";
import { buildBenchIndex } from "./domain/bench-index.js";
import { updateSavedCount } from "./ui/save.js";
import { palette } from "./core/search.js";
import { route } from "./app/router.js";
import { initTheme } from "./app/theme.js";

async function start() {
  initTheme();
  try {
    const [sources, datasets] = await Promise.all([load("sources"), load("datasets")]);
    S.fields = sources.fields;
    S.sources = sources.sources;
    S.datasets = datasets.datasets;
    const [status, build] = await Promise.allSettled([load("status"), load("build")]);
    S.status = status.status === "fulfilled" ? status.value : null;
    S.build = build.status === "fulfilled" ? build.value : null;
  } catch (err) {
    view.innerHTML = `<p class="note">The data files could not be loaded (${esc(err.message)}). If you opened this page from a folder, serve it over HTTP instead.</p>`;
    return;
  }
  if (S.build) document.getElementById("foot-build").textContent = `Data built ${prettyDate(S.build.generated_at)} by ${S.build.engine}.`;
  window.addEventListener("hashchange", route);
  updateSavedCount();
  route();
  // Load papers in the background so search covers them too.
  setTimeout(() => need("latest").then(() => palette.refresh()), 1200);
  setTimeout(() => Promise.all([needTables(), need("boards")]).then(([t, b]) => { buildBenchIndex(t, b?.boards || []); palette.refresh(); }).catch(() => {}), 2500);
}

// Back to top, shown after the reader scrolls a screen.
const toTop = document.getElementById("to-top");

window.addEventListener("scroll", () => { toTop.hidden = window.scrollY < window.innerHeight; }, { passive: true });

toTop.addEventListener("click", () => { window.scrollTo({ top: 0, behavior: "smooth" }); view.focus({ preventScroll: true }); });

start();
