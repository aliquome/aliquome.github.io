// #saved
import { view, esc, toast, copy } from "../core/dom.js";
import { saved, bibtex, manifest, downloadText } from "../services/library.js";

export function pageSaved() {
  const draw = () => {
    const items = saved.all();
    const groups = [["database", "Databases"], ["dataset", "Datasets"], ["paper", "Papers"]];
    const papers = items.filter((x) => x.type === "paper");
    const data = items.filter((x) => x.type !== "paper");
    view.innerHTML = `<div class="page"><section class="section">
      <h1>Saved</h1>
      <p class="lede">Your reading list and the exact data releases for a project, kept in this browser. Export them to cite the papers and to fetch the same data again later.</p>
      ${items.length ? `<div class="export">
        <div><b>Data manifest</b><p class="hint">Name, release and direct link of every saved database and dataset, as a tab-separated file you can keep next to your analysis.</p>
          <div class="export-actions"><button class="btn solid" type="button" data-export="manifest" ${data.length ? "" : "disabled"}>Download manifest.tsv</button><button class="btn" type="button" data-export="manifest-copy" ${data.length ? "" : "disabled"}>Copy</button></div></div>
        <div><b>References</b><p class="hint">BibTeX entries for every saved paper, ready for LaTeX, Zotero or any reference manager.</p>
          <div class="export-actions"><button class="btn solid" type="button" data-export="bib" ${papers.length ? "" : "disabled"}>Download references.bib</button><button class="btn" type="button" data-export="bib-copy" ${papers.length ? "" : "disabled"}>Copy</button></div></div>
      </div>` : ""}
      ${items.length ? groups.map(([type, label]) => {
        const list = items.filter((x) => x.type === type);
        if (!list.length) return "";
        return `<div class="saved-group"><h2>${label} <span class="count">${list.length}</span></h2><ul class="saved-list">${list.map((x) => `
          <li><div><a href="${esc(x.href)}" ${x.type === "paper" ? 'target="_blank" rel="noopener"' : ""}>${esc(x.title)}</a>
            <p class="hint">${x.type === "paper" ? esc([x.paper?.journal, x.paper?.year].filter(Boolean).join(", ")) : `${x.version ? `Release ${esc(x.version)}. ` : ""}<span class="mono">${esc(x.url || "no direct link")}</span>`}</p></div>
            <div class="saved-actions">${x.url && x.type !== "paper" ? `<button class="btn small" type="button" data-copy="${esc(x.url)}">Copy link</button>` : ""}${x.type === "paper" && x.paper ? `<button class="btn small" type="button" data-cite-saved="${esc(x.key)}">Cite</button>` : ""}<button class="btn small" type="button" data-unsave="${esc(x.key)}">Remove</button></div></li>`).join("")}</ul></div>`;
      }).join("") + `<p><button class="btn" type="button" data-clear-saved>Remove everything</button></p>`
      : `<div class="empty"><svg width="40" height="40" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h8v12.4L8 11.2l-4 3z" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>
          <h2>Nothing saved yet</h2><p class="hint">Press the bookmark on any database, dataset or paper. It will appear here, ready to export.</p>
          <p class="chips"><a class="chip plain" href="#sources">Browse databases</a><a class="chip plain" href="#latest">Read new papers</a></p></div>`}
    </section></div>`;
  };
  draw();
  view.onclick = (e) => {
    const t = e.target.closest("[data-unsave],[data-clear-saved],[data-export],[data-cite-saved]");
    if (!t) return;
    const items = saved.all();
    if (t.dataset.unsave) { saved.remove(t.dataset.unsave); draw(); return; }
    if (t.hasAttribute("data-clear-saved")) {
      if (t.dataset.confirm) { saved.clear(); draw(); toast("Saved items removed"); }
      else { t.dataset.confirm = "1"; t.textContent = "Press again to remove everything"; }
      return;
    }
    if (t.dataset.citeSaved) { const x = items.find((i) => i.key === t.dataset.citeSaved); if (x?.paper) copy(bibtex(x.paper)); return; }
    const bib = items.filter((x) => x.type === "paper" && x.paper).map((x) => bibtex(x.paper)).join("\n\n");
    const tsv = manifest(items);
    ({ manifest: () => downloadText("manifest.tsv", tsv, "text/tab-separated-values"), "manifest-copy": () => copy(tsv),
       bib: () => downloadText("references.bib", bib, "application/x-bibtex"), "bib-copy": () => copy(bib) })[t.dataset.export]?.();
  };
}
