// The site-wide search index behind the command palette (Ctrl+K).
import { esc } from "./dom.js";
import { S, dataVersion } from "./store.js";
import { paperIndex } from "./catalog.js";
import { prettyDate } from "../domain/format.js";
import { approvedView } from "../domain/ranking.js";
import { benchIdx, modelHref, paperHref, summarize } from "../domain/bench-index.js";
import { mountPalette } from "../services/library.js";

// Built once from the loaded data; papers join when their files arrive.
let searchIndex = null, builtFor = -1;
// rebuild when more data has loaded or the benchmark index has appeared
const stamp = () => dataVersion * 2 + (benchIdx ? 1 : 0);

export function buildIndex() {
  const idx = [
    ["Databases", "Every release with a direct link", "#sources"],
    ["Datasets", "Benchmarks and training data", "#datasets"],
    ["New papers", "Last 60 days in the leading journals", "#latest"],
    ["Most cited papers", "By field, all time and last 24 months", "#papers"],
    ["Benchmarks", "Published model comparisons", "#benchmarks"],
    ["Saved items", "Your reading list and data manifest", "#saved"],
    ["Source status", "Reachability checks every two days", "#status"],
    ["How the atlas is built", "Reproducibility and citation", "#about"],
  ].map(([title, sub, href]) => ({ kind: "Page", title, sub, href, text: title.toLowerCase() }));
  for (const s of S.sources) {
    idx.push({ kind: "Database", title: s.name, sub: `current ${s.latest || "—"}`, href: `#source/${s.id}`,
      text: `${s.name} ${s.summary} ${s.id}`.toLowerCase() });
    for (const v of s.versions) {
      idx.push({ kind: "Release", title: `${s.name} ${v.version}`, sub: [v.status, v.date].filter(Boolean).join(", "), href: `#source/${s.id}`,
        text: `${s.name} ${v.version} ${v.note}`.toLowerCase() });
    }
  }
  for (const d of S.datasets) {
    idx.push({ kind: "Dataset", title: d.name, sub: d.category, href: `#datasets/${d.field}/${encodeURIComponent(d.name)}`,
      text: `${d.name} ${d.description}`.toLowerCase() });
  }
  for (const t of S.tables || []) {
    idx.push({ kind: "Benchmark", title: `${t.task} on ${t.dataset}`, sub: `${t.rows.length} results, ranked by ${approvedView(t).metric}`, href: `#benchmarks/${t.id}`,
      text: `${t.task} ${t.dataset} ${t.rows.map((r) => r.model).join(" ")}`.toLowerCase() });
  }
  if (benchIdx) {
    for (const [name, list] of benchIdx.byModel) {
      const s = summarize(list);
      idx.push({ kind: "Model", title: name, sub: `${s.tables} rankings${s.first ? `, first in ${s.first}` : ""}`, href: modelHref(name), text: name.toLowerCase() });
    }
    for (const [name, list] of benchIdx.byPaper) {
      idx.push({ kind: "Results paper", title: name, sub: `${summarize(list).tables} rankings`, href: paperHref(name), text: name.toLowerCase() });
    }
  }
  for (const p of S.latest?.papers || []) {
    paperIndex.set(p.id, p);
    idx.push({ kind: "Paper", title: p.title, sub: `${p.journal}, ${prettyDate(p.date)}`, href: `#latest/${p.fields?.[0] || ""}/${encodeURIComponent(p.title.slice(0, 60).replace(/[/%]/g, " "))}`,
      text: `${p.title} ${p.authors} ${p.keywords.join(" ")}`.toLowerCase() });
  }
  searchIndex = idx;
  builtFor = stamp();
  return idx;
}

export const palette = mountPalette(() => (searchIndex && builtFor === stamp() ? searchIndex : buildIndex()), esc);
