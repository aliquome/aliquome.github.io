// Checks the site's clean addresses on the pages scripts/static-pages.mjs wrote:
//   - every page's path maps to a route and back to the same path
//   - every internal link on every page points to a page or file that exists
//   - no page links to an old "#route" address
//   - titles, canonical addresses and descriptions are present and unique
//   - the sitemap lists only pages that exist
// Run after the page writer: node tests/paths.test.mjs [site-dir]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configurePaths, toPath, fromPath, isRouteHash } from "../site/assets/domain/paths.js";
import { keyed } from "../site/assets/domain/bench-index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(process.argv[2] || path.join(HERE, "../site"));
const BASE = "https://aliquome.github.io";
let passes = 0, failures = 0;
const ok = (cond, msg) => { if (cond) passes++; else { failures++; console.log(`  FAIL  ${msg}`); } };
const say = (msg) => console.log(`  ok    ${msg}`);

const { fields } = JSON.parse(fs.readFileSync(path.join(SITE, "data/sources.json"), "utf8"));
const { datasets } = JSON.parse(fs.readFileSync(path.join(SITE, "data/datasets.json"), "utf8"));
configurePaths({ fields: fields.map((f) => f.id), datasetSlugs: keyed(datasets.map((d) => d.name)) });

// all pages on disk
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["assets", "data"].includes(e.name) || dir !== SITE) walk(p); }
    else if (e.name === "index.html") pages.push("/" + path.relative(SITE, dir).split(path.sep).filter(Boolean).map((s) => s).join("/") + (dir === SITE ? "" : "/"));
  }
})(SITE);
ok(pages.length > 2000, `pages found: ${pages.length}`);
say(`${pages.length} pages on disk`);

// 1. paths <-> routes
let roundTrip = 0;
for (const p of pages) {
  const r = fromPath(p, "");
  ok(r, `${p} is a route`);
  if (!r) continue;
  const back = toPath(r);
  ok(back === p, `${p} -> ${JSON.stringify(r)} -> ${back}`);
  if (back === p) roundTrip++;
}
say(`${roundTrip} paths map to a route and back`);
// filters in the query string
const queries = [
  ["/db/?field=proteins", ["sources", "proteins"]],
  ["/datasets/?field=chemistry", ["datasets", "chemistry"]],
  ["/datasets/?q=protein", ["datasets", "", "protein"]],
  ["/papers/?field=rna&task=rna%3Afolding", ["latest", "rna", "rna:folding"]],
  ["/papers/top/?field=cancer", ["papers", "cancer"]],
  ["/benchmarks/?field=chemistry", ["benchmarks", "chemistry"]],
  ["/benchmarks/?field=chemistry&q=bbbp", ["benchmarks", "chemistry", "bbbp"]],
  ["/models/?q=gnn", ["benchmarks", "models", "gnn"]],
  ["/benchmarks/papers/?q=graph", ["benchmarks", "papers", "graph"]],
];
for (const [url, route] of queries) {
  const [p, q] = url.split("?");
  const r = fromPath(p, `?${q}`);
  ok(JSON.stringify(r.filter(Boolean)) === JSON.stringify(route.filter(Boolean)), `${url} -> ${JSON.stringify(r)}`);
  ok(toPath(route) === url, `${JSON.stringify(route)} -> ${toPath(route)} (want ${url})`);
}
say(`${queries.length} filter addresses map both ways`);
// old addresses
const legacy = [["#home", "/"], ["#sources", "/db/"], ["#sources/proteins", "/db/?field=proteins"], ["#source/gnomad", "/db/gnomad/"],
  ["#datasets/proteins/TAPE", "/datasets/tape/"], ["#latest", "/papers/"], ["#latest/rna", "/papers/?field=rna"], ["#papers", "/papers/top/"],
  ["#benchmarks", "/benchmarks/"], ["#benchmarks/chemistry", "/benchmarks/?field=chemistry"], ["#benchmarks/molecular-property-prediction-bbbp", "/benchmarks/molecular-property-prediction-bbbp/"],
  ["#benchmarks/model/chembfn", "/models/chembfn/"], ["#benchmarks/models", "/models/"], ["#benchmarks/papers", "/benchmarks/papers/"],
  ["#status", "/status/"], ["#about", "/about/"], ["#saved", "/saved/"]];
for (const [h, want] of legacy) { ok(isRouteHash(h), `${h} is an old route`); ok(toPath(h) === want, `${h} -> ${toPath(h)} (want ${want})`); }
ok(!isRouteHash("#access_token=x") && !isRouteHash("#bmore") && !isRouteHash(""), "sign-in and in-page anchors are not routes");
say(`${legacy.length} old #addresses move to their paths`);
ok(fromPath("/nope/") === null && fromPath("/db/a/b/") === null && fromPath("/data/sources.json") === null, "unknown paths are not routes");

// 2. links, titles, canonical, descriptions
const exists = (u) => {
  const p = decodeURIComponent(u.split(/[?#]/)[0]);
  const f = path.join(SITE, p);
  return p.endsWith("/") ? fs.existsSync(path.join(f, "index.html")) : fs.existsSync(f);
};
const titles = new Map(), canon = new Set();
let links = 0, broken = 0, hashLinks = 0;
for (const p of pages) {
  const html = fs.readFileSync(path.join(SITE, p, "index.html"), "utf8");
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const c = (html.match(/<link rel="canonical" href="([^"]*)">/) || [])[1];
  const d = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1];
  ok(title && title.length > 5, `${p} has a title`);
  ok(d && d.length >= 50, `${p} has a description of 50+ characters (${d?.length})`);
  if (p !== "/") ok(c === BASE + p, `${p} canonical is ${c}`);
  if (p !== "/") (titles.get(title) || titles.set(title, []).get(title)).push(p);
  canon.add(c);
  for (const m of html.matchAll(/href="([^"]*)"/g)) {
    const h = m[1].replace(/&amp;/g, "&");
    if (h.startsWith("#")) { if (isRouteHash(h)) hashLinks++; continue; }
    if (!h.startsWith("/") || h.startsWith("//")) continue;
    links++;
    if (!exists(h)) { broken++; if (broken < 10) console.log(`  FAIL  ${p} links to missing ${h}`); }
  }
  ok(!/<main id="view"[^>]*>\s*<p class="loading">/.test(html) || p === "/", `${p} has its content in the HTML`);
}
ok(broken === 0, `${broken} broken internal links`);
ok(hashLinks === 0, `${hashLinks} links to old #addresses`);
say(`${links} internal links checked, none broken, none to an old #address`);
const dupes = [...titles].filter(([, ps]) => ps.length > 1);
ok(dupes.length === 0, `duplicate titles: ${dupes.slice(0, 3).map(([t, ps]) => `${t} (${ps.join(", ")})`).join("; ")}`);
say("every page has its own title, description and canonical address");

// 3. sitemap
const sm = fs.readFileSync(path.join(SITE, "sitemap.xml"), "utf8");
const locs = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
ok(locs.length > 2000, `sitemap has ${locs.length} addresses`);
const missing = locs.filter((l) => !l.startsWith(BASE + "/") || !exists(l.slice(BASE.length)));
ok(missing.length === 0, `sitemap addresses without a page: ${missing.slice(0, 5).join(", ")}`);
ok(!locs.some((l) => l.includes("/saved/") || l.includes("404")), "the sitemap leaves out saved items and 404");
ok(fs.readFileSync(path.join(SITE, "robots.txt"), "utf8").includes(`Sitemap: ${BASE}/sitemap.xml`), "robots.txt names the sitemap");
say(`sitemap: ${locs.length} addresses, all with a page`);
ok(fs.existsSync(path.join(SITE, "404.html")) && /noindex/.test(fs.readFileSync(path.join(SITE, "404.html"), "utf8")), "404.html exists and is not indexed");

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
