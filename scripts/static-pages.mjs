// Writes one plain HTML page per database, dataset, benchmark table and model,
// an index page for each kind, sitemap.xml and robots.txt, so that search
// engines can find and show every item on its own. The interactive site keeps
// its hash routes; each page links to its place there.
// Run after the engine: node scripts/static-pages.mjs [site-dir]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { approvedView, rankRows } from "../site/assets/domain/ranking.js";
import { buildBenchIndex, keyed, paperName } from "../site/assets/domain/bench-index.js";
import { snippets, typeOf } from "../site/assets/domain/links.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_DIR = path.resolve(process.argv[2] || path.join(ROOT, "site"));
const BASE = "https://aliquome.github.io/";
const KINDS = ["db", "datasets", "benchmarks", "models"];

const read = (p) => JSON.parse(fs.readFileSync(path.join(SITE_DIR, p), "utf8"));
const { fields, sources } = read("data/sources.json");
const { datasets } = read("data/datasets.json");
const build = read("data/build.json");
const { boards } = read("data/leaderboards.json");
let approved = new Map();
try { approved = new Map((read("data/rankings.json").table || []).map((t) => [t.id, t])); } catch { /* none yet */ }
const tables = fields.flatMap((f) => {
  const p = path.join(SITE_DIR, "data/benchmarks", `pwc-${f.id}.json`);
  if (!fs.existsSync(p)) return [];
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return j.tables.map((t) => ({ ...t, source_name: j.source, source_url: j.url, approved: approved.get(t.id) || null }));
});
const idx = buildBenchIndex(tables, boards);
const today = String(build.generated_at || new Date().toISOString()).slice(0, 10);
const label = Object.fromEntries(fields.map((f) => [f.id, f.label]));

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const clip = (s, n) => { s = clean(s); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
const safe = (u) => (/^(https?|ftp|s3|gs):\/\//i.test(u || "") ? u : "");
const link = (u, text) => (safe(u) ? `<a href="${esc(u)}" rel="nofollow noopener">${esc(text ?? u)}</a>` : esc(text ?? u ?? ""));
const num = (n) => Number(n || 0).toLocaleString("en-US");
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const crumbs = (items) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: BASE + url })),
});
const datasetKey = keyed(datasets.map((d) => d.name));

const pages = []; // [url, html]
function page({ url, title, description, h1, crumb, body, atlas, schema = [] }) {
  const canonical = BASE + url;
  const trail = [["Aliquome", ""], ...crumb];
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(clip(description, 158))}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Aliquome">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(clip(description, 200))}">
<meta property="og:image" content="${BASE}og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0f1f24">
<script>try{var t=localStorage.getItem("atlas-theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;600&display=swap">
<link rel="stylesheet" href="/assets/style.css">
<link rel="stylesheet" href="/assets/static.css">
${ld(crumbs(trail.slice(1)))}
${schema.map(ld).join("\n")}
</head>
<body class="static">
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="/" aria-label="Aliquome, home">
      <svg class="brand-trace" viewBox="0 0 34 24" aria-hidden="true"><path d="M1 22 C5 22 6 3 9 3 S12 22 15 22" fill="none" stroke="var(--base-a)" stroke-width="2"/><path d="M8 22 C12 22 13 9 16 9 S19 22 22 22" fill="none" stroke="var(--base-c)" stroke-width="2"/><path d="M15 22 C19 22 20 6 23 6 S26 22 29 22" fill="none" stroke="var(--base-g)" stroke-width="2"/><path d="M22 22 C25 22 26 13 28 13 S31 22 33 22" fill="none" stroke="var(--base-t)" stroke-width="2"/></svg>
      <span>Aliquome</span>
    </a>
    <nav class="nav" aria-label="Sections">
      <a href="/">Home</a><a href="/db/">Databases</a><a href="/datasets/">Datasets</a><a href="/#latest">Papers</a><a href="/benchmarks/">Benchmarks</a>
    </nav>
  </div>
</header>
<main class="wrap static-main" id="view">
<nav class="crumbs" aria-label="Breadcrumb">${trail.map(([n, u], i) => (i === trail.length - 1 ? `<span aria-current="page">${esc(n)}</span>` : `<a href="/${u}">${esc(n)}</a><span aria-hidden="true">/</span>`)).join("")}</nav>
<h1>${esc(h1)}</h1>
${body}
${atlas ? `<p class="static-atlas"><a class="btn solid" href="/${atlas}">Open in the interactive atlas</a></p>` : ""}
</main>
<footer class="foot">
  <div class="wrap foot-grid">
    <div class="foot-col"><p class="foot-title">Aliquome</p><p>Every release of the core bioinformatics databases, public datasets, new papers and model comparisons, rebuilt every two days. Last build ${esc(today)}.</p></div>
    <div class="foot-col"><p class="foot-title">Browse</p><a href="/db/">All databases</a><a href="/datasets/">All datasets</a><a href="/benchmarks/">All benchmark tables</a><a href="/models/">All models</a></div>
    <div class="foot-col"><p class="foot-title">Project</p><a href="https://github.com/aliquome/aliquome.github.io">Source code on GitHub</a><a href="/#about">Cite and reproduce</a></div>
    <div class="foot-col"><p class="foot-title">Contact</p><p><a href="mailto:alikianfar0@gmail.com">alikianfar0@gmail.com</a></p><p>The atlas links to data and hosts none of it. Confirm each source’s licence before use.</p></div>
  </div>
</footer>
</body>
</html>
`;
  pages.push([url, html]);
}

const table = (head, rows, cls = "") => `<div class="table-wrap"><table class="static-table ${cls}"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const facts = (pairs) => `<dl class="facts">${pairs.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
const code = (url, type) => {
  const sn = snippets(url, typeOf(url, type));
  return sn.length ? `<div class="static-code">${sn.map(([lang, src]) => `<h3>${esc(lang)}</h3><pre><code>${esc(src)}</code></pre>`).join("")}</div>` : "";
};

// ---------- databases ----------
for (const s of sources) {
  const vs = s.versions || [];
  const description = `${s.name}: ${clean(s.summary)} All ${plural(vs.length, "release")} with direct download links and code${s.latest ? `; current release ${s.latest}${s.latest_date ? ` (${s.latest_date})` : ""}` : ""}.`;
  const tasks = tables.filter((t) => t.field === s.field).length;
  page({
    url: `db/${s.id}/`,
    title: `${s.name}: all releases and download links | Aliquome`,
    description,
    h1: s.name,
    crumb: [["Databases", "db/"], [s.name, `db/${s.id}/`]],
    atlas: `#source/${s.id}`,
    body: `<p class="lede">${esc(s.summary)}</p>
${facts([["Field", `<a href="/db/#${esc(s.field)}">${esc(label[s.field] || s.field)}</a>`], ["Current release", s.latest ? `<b>${esc(s.latest)}</b> ${esc(s.latest_date || "")}` : ""], ["Releases tracked", num(vs.length)], ["Licence", esc(s.license || "")], ["Website", link(s.homepage)]])}
${s.latest_url ? `<h2>Download the current release</h2><p class="url-line"><code>${esc(s.latest_url)}</code></p>${code(s.latest_url, s.latest_url_type)}` : ""}
<h2>Every release of ${esc(s.name)}</h2>
${table(["Release", "Date", "Status", "Download"], [...vs].reverse().map((v) => [`<b>${esc(v.version)}</b>`, esc(v.date || ""), esc(v.status || ""), v.url ? link(v.url) : `<span class="muted">${esc(v.note || "no direct link")}</span>`]))}
${tasks ? `<p class="hint">Related: <a href="/benchmarks/#${esc(s.field)}">${plural(tasks, "benchmark table")} in ${esc(label[s.field] || s.field)}</a>.</p>` : ""}`,
    schema: [{
      "@context": "https://schema.org", "@type": "Dataset", name: s.name, description: clip(description, 4900),
      url: BASE + `db/${s.id}/`, sameAs: safe(s.homepage) || undefined, version: s.latest || undefined, license: s.license || undefined,
      isAccessibleForFree: true, keywords: [label[s.field], "bioinformatics database", `${s.name} download`, `${s.name} versions`].filter(Boolean),
      distribution: safe(s.latest_url) && /^https?:/.test(s.latest_url) ? [{ "@type": "DataDownload", contentUrl: s.latest_url, name: `${s.name} ${s.latest || ""}`.trim() }] : undefined,
      includedInDataCatalog: { "@type": "DataCatalog", name: "Aliquome", url: BASE },
    }],
  });
}

// ---------- datasets ----------
const tablesOfDataset = new Map();
for (const t of tables) if (t.dataset_id) (tablesOfDataset.get(t.dataset_id) || tablesOfDataset.set(t.dataset_id, []).get(t.dataset_id)).push(t);
for (const d of datasets) {
  const key = datasetKey.get(d.name);
  const ts = tablesOfDataset.get(d.id) || [];
  const description = `${d.name} dataset: ${clean(d.description)}`;
  page({
    url: `datasets/${key}/`,
    title: `${d.name} dataset: download, code and benchmarks | Aliquome`,
    description,
    h1: d.name,
    crumb: [["Datasets", "datasets/"], [d.name, `datasets/${key}/`]],
    atlas: `#datasets/${d.field}/${encodeURIComponent(d.name)}`,
    body: `<p class="lede">${esc(d.description)}</p>
${facts([["Field", `<a href="/datasets/#${esc(d.field)}">${esc(label[d.field] || d.field)}</a>`], ["Category", esc(d.category || "")], ["Licence", esc(d.license || "")], ["Versions", esc(d.versions || "")], ["Access", esc(d.access || "")], ["Repository", d.repo ? link(d.repo) + (d.stars ? ` <span class="muted">${num(d.stars)} stars</span>` : "") : ""], ["Papers using it", d.paper_count ? num(d.paper_count) : ""]])}
${(d.links || []).length ? `<h2>Download ${esc(d.name)}</h2><ul class="static-links">${d.links.map((l) => `<li>${esc(l.label)}: ${link(l.url)}</li>`).join("")}</ul>${code(d.links[0].url)}` : ""}
${ts.length ? `<h2>Benchmarks on ${esc(d.name)}</h2><ul class="static-links">${ts.map((t) => `<li><a href="/benchmarks/${esc(t.id)}/">${esc(t.task)} on ${esc(t.dataset)}</a> <span class="muted">${plural(t.rows.length, "result")}</span></li>`).join("")}</ul>` : ""}`,
    schema: [{
      "@context": "https://schema.org", "@type": "Dataset", name: d.name, description: clip(description.length < 60 ? `${description} Download links, code and benchmark results on Aliquome.` : description, 4900),
      url: BASE + `datasets/${key}/`, license: d.license || undefined, isAccessibleForFree: true, sameAs: safe(d.repo) || undefined,
      keywords: [label[d.field], d.category, "machine learning", "bioinformatics dataset"].filter(Boolean),
      distribution: (d.links || []).filter((l) => /^https?:/.test(l.url || "")).slice(0, 10).map((l) => ({ "@type": "DataDownload", contentUrl: l.url, name: l.label })),
      includedInDataCatalog: { "@type": "DataCatalog", name: "Aliquome", url: BASE },
    }],
  });
}

// ---------- benchmark tables ----------
const modelLink = (m) => (idx.modelKey.has(m) ? `<a href="/models/${esc(idx.modelKey.get(m))}/">${esc(m)}</a>` : esc(m));
for (const t of tables) {
  const v = approvedView(t);
  const ranked = rankRows(t, v);
  const metrics = t.metrics.filter((m) => m.parsed >= 2).map((m) => m.name);
  const shown = [v.metric, ...metrics.filter((m) => m !== v.metric)].slice(0, 4);
  const best = ranked.find((x) => x.rank === 1);
  const ds = t.dataset_id ? datasets.find((d) => d.id === t.dataset_id) : null;
  const description = `${t.task} on ${t.dataset}: ${plural(ranked.length, "published result")} ranked by ${v.metric}${best ? `; best ${best.r.model} (${best.r.values[v.metric]})` : ""}. ${clean(t.description || "")}`;
  page({
    url: `benchmarks/${t.id}/`,
    title: `${t.task} on ${t.dataset}: leaderboard and results | Aliquome`,
    description,
    h1: `${t.task} on ${t.dataset}`,
    crumb: [["Benchmarks", "benchmarks/"], [`${t.task} on ${t.dataset}`, `benchmarks/${t.id}/`]],
    atlas: `#benchmarks/${t.id}`,
    body: `<p class="lede">${esc(plural(ranked.length, "published result"))}, ranked by <b>${esc(v.metric)}</b> (${v.higher ? "higher is better" : "lower is better"}).${ds ? ` About the data and how to download it: <a href="/datasets/${esc(datasetKey.get(ds.name))}/">${esc(ds.name)}</a>.` : ""}</p>
${t.description ? `<p>${esc(clip(t.description, 600))}</p>` : ""}
${table(["#", "Model", ...shown.map(esc), "Paper", "Code"], ranked.map((x) => [x.rank ?? "–", `<b>${modelLink(x.r.model)}</b>${x.r.extra ? ' <span class="tag">extra data</span>' : ""}`, ...shown.map((m) => `<span class="num">${esc(x.r.values[m] ?? "")}</span>`), `${link(x.r.url, clip(paperName(x.r.paper), 90))}${x.r.date ? ` <span class="muted">${esc(String(x.r.date).slice(0, 4))}</span>` : ""}`, x.r.code ? link(x.r.code, "Code") : ""]), "bench")}
<p class="hint">Source: ${link(t.source_url, t.source_name || "Papers with Code archive")}. Field: <a href="/benchmarks/#${esc(t.field)}">${esc(label[t.field] || t.field)}</a>.</p>`,
  });
}
for (const b of boards) {
  page({
    url: `benchmarks/${b.id}/`,
    title: `${b.title}: leaderboard | Aliquome`,
    description: `${b.title}: ${plural(b.rows.length, "model")} ranked by ${b.metric_label}${b.rows[0] ? `; best ${b.rows[0].model}` : ""}. From ProteinGym.`,
    h1: b.title,
    crumb: [["Benchmarks", "benchmarks/"], [b.title, `benchmarks/${b.id}/`]],
    atlas: `#benchmarks/${b.id}`,
    body: `<p class="lede">${plural(b.rows.length, "model")}, ranked by <b>${esc(b.metric_label)}</b>.</p>
${table(["#", "Model", esc(b.metric_label), "Paper"], b.rows.map((r) => [r.rank, `<b>${modelLink(r.model)}</b>`, `<span class="num">${esc(r.score.toFixed(3))}</span>`, link(r.paper_url, clip(paperName(r.paper), 90))]), "bench")}
<p class="hint">Source: ${link(b.source, "ProteinGym")}.</p>`,
  });
}

// ---------- models ----------
for (const [model, entries] of idx.byModel) {
  const key = idx.modelKey.get(model);
  const ranked = entries.filter((e) => e.rank != null);
  const bestPlace = ranked.length ? Math.min(...ranked.map((e) => e.rank)) : null;
  const tasks = [...new Set(entries.map((e) => e.task))];
  const papers = [...new Set(entries.map((e) => e.paper).filter(Boolean))];
  const description = `${model}: results in ${plural(entries.length, "bioinformatics benchmark")} (${clip(tasks.join(", "), 90)})${bestPlace ? `, best place ${bestPlace}` : ""}.${papers[0] ? ` Reported in “${clip(papers[0], 80)}”.` : ""}`;
  page({
    url: `models/${key}/`,
    title: `${model}: benchmark results and rankings | Aliquome`,
    description,
    h1: model,
    crumb: [["Models", "models/"], [model, `models/${key}/`]],
    atlas: `#benchmarks/model/${key}`,
    body: `<p class="lede">In ${plural(entries.length, "ranking")}${bestPlace ? `, best place ${bestPlace}` : ""}.</p>
${papers.length ? `<p>Reported in ${papers.slice(0, 5).map((p) => `“${esc(clip(p, 120))}”`).join(", ")}${papers.length > 5 ? ` and ${num(papers.length - 5)} more` : ""}.</p>` : ""}
${table(["Ranking", "Dataset", "Place", "Results"], entries.map((e) => [`<a href="/benchmarks/${esc(e.id)}/"><b>${esc(e.task)}</b></a>`, esc(e.dataset), e.out ? "left out" : e.rank == null ? "no score" : `${e.rank} of ${e.total}`, e.metrics.map((m) => `${esc(m.name)} <span class="num">${esc(m.value)}</span>`).join("<br>")]), "bench")}`,
  });
}

// ---------- index pages ----------
const byField = (items, key) => fields.map((f) => [f, items.filter((x) => key(x) === f.id)]).filter(([, xs]) => xs.length);
page({
  url: "db/", title: `${sources.length} bioinformatics databases with every release and download link | Aliquome`,
  description: `Every release of ${sources.length} core bioinformatics databases (${sources.slice(0, 8).map((s) => s.name).join(", ")} and more) with direct, versioned download links and code.`,
  h1: "Bioinformatics databases", crumb: [["Databases", "db/"]], atlas: "#sources",
  body: byField(sources, (s) => s.field).map(([f, xs]) => `<h2 id="${esc(f.id)}">${esc(f.label)}</h2><ul class="static-links">${xs.map((s) => `<li><a href="/db/${esc(s.id)}/"><b>${esc(s.name)}</b></a>: ${esc(s.summary)} <span class="muted">${plural((s.versions || []).length, "release")}</span></li>`).join("")}</ul>`).join("\n"),
});
page({
  url: "datasets/", title: `${datasets.length} machine learning datasets for biology | Aliquome`,
  description: `${datasets.length} public datasets for machine learning in biology: proteins, molecules, single-cell, genomics, histopathology and biomedical text, with download links, code and benchmarks.`,
  h1: "Datasets for machine learning in biology", crumb: [["Datasets", "datasets/"]], atlas: "#datasets",
  body: byField(datasets, (d) => d.field).map(([f, xs]) => `<h2 id="${esc(f.id)}">${esc(f.label)}</h2><ul class="static-links">${[...xs].sort((a, b) => a.name.localeCompare(b.name)).map((d) => `<li><a href="/datasets/${esc(datasetKey.get(d.name))}/"><b>${esc(d.name)}</b></a>: ${esc(clip(d.description, 150))}</li>`).join("")}</ul>`).join("\n"),
});
page({
  url: "benchmarks/", title: `${tables.length + boards.length} bioinformatics benchmark tables and leaderboards | Aliquome`,
  description: `${tables.length + boards.length} results tables and leaderboards for machine learning in biology, ${num(idx.byModel.size)} models: molecular property prediction, protein function, drug–target interaction and more.`,
  h1: "Benchmark tables and leaderboards", crumb: [["Benchmarks", "benchmarks/"]], atlas: "#benchmarks",
  body: `${boards.length ? `<h2>ProteinGym</h2><ul class="static-links">${boards.map((b) => `<li><a href="/benchmarks/${esc(b.id)}/"><b>${esc(b.title)}</b></a> <span class="muted">${plural(b.rows.length, "model")}</span></li>`).join("")}</ul>` : ""}
${byField(tables, (t) => t.field).map(([f, xs]) => `<h2 id="${esc(f.id)}">${esc(f.label)}</h2><ul class="static-links">${[...xs].sort((a, b) => a.task.localeCompare(b.task) || a.dataset.localeCompare(b.dataset)).map((t) => `<li><a href="/benchmarks/${esc(t.id)}/"><b>${esc(t.task)}</b> on ${esc(t.dataset)}</a> <span class="muted">${plural(t.rows.length, "result")}, ${esc(t.metric)}</span></li>`).join("")}</ul>`).join("\n")}`,
});
const models = [...idx.byModel.keys()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
page({
  url: "models/", title: `${models.length} models compared on bioinformatics benchmarks | Aliquome`,
  description: `${models.length} machine learning models for biology and chemistry, each with its results and rank on every benchmark table it appears in.`,
  h1: "Models", crumb: [["Models", "models/"]], atlas: "#benchmarks/models",
  body: `<ul class="static-columns">${models.map((m) => `<li><a href="/models/${esc(idx.modelKey.get(m))}/">${esc(m)}</a> <span class="muted">${idx.byModel.get(m).length}</span></li>`).join("")}</ul>`,
});

// ---------- write ----------
for (const k of KINDS) fs.rmSync(path.join(SITE_DIR, k), { recursive: true, force: true });
for (const [url, html] of pages) {
  const dir = path.join(SITE_DIR, url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}
const urls = ["", ...pages.map(([u]) => u)];
fs.writeFileSync(path.join(SITE_DIR, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(BASE + u)}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(SITE_DIR, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);
const count = (k) => pages.filter(([u]) => u.startsWith(`${k}/`) && u !== `${k}/`).length;
console.log(`static pages: ${count("db")} databases, ${count("datasets")} datasets, ${count("benchmarks")} benchmark tables, ${count("models")} models, 4 index pages; sitemap with ${urls.length} URLs`);
