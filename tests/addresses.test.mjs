// Browser test of the site's clean addresses (see site/assets/domain/paths.js)
// against a server that answers as GitHub Pages does. Every kind of page loads
// at its own address; clicks, Back and Forward, filters and search move between
// pages without reloading; old #addresses move to their paths; unknown pages
// answer 404; the content is in the HTML without JavaScript; phones fit.
// Run after scripts/static-pages.mjs: node tests/addresses.test.mjs [site-dir]
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(process.argv[2] || path.join(HERE, "../site"));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let p;
  try { p = path.join(ROOT_DIR, decodeURIComponent(u.pathname)); } catch { res.writeHead(400); return res.end(); }
  if (!p.startsWith(ROOT_DIR)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    if (!u.pathname.endsWith("/")) { res.writeHead(301, { Location: u.pathname + "/" + u.search }); return res.end(); }
    p = path.join(p, "index.html");
  }
  let status = 200;
  if (!fs.existsSync(p)) { status = 404; p = path.join(ROOT_DIR, "404.html"); }
  res.writeHead(status, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const SITE = `http://127.0.0.1:${server.address().port}`;
const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((x) => fs.existsSync(x));
if (!chrome) { console.error("No Chrome found; set CHROME_PATH."); process.exit(2); }
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   ", m); } else { fail++; console.log("  FAIL ", m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));
p.on("console", (m) => { if (m.type() === "error" && !/favicon|fonts\.g/.test(m.text())) errors.push(`${p.url()}: ${m.text()}`); });
await p.setViewport({ width: 1280, height: 900 });
// notes whether a loading placeholder ever replaced the content written into the page
await p.evaluateOnNewDocument(() => {
  new MutationObserver(() => { if (document.querySelector("#view .loading") && !document.querySelector("#view > .static-page")) window.__sawLoading = true; })
    .observe(document, { subtree: true, childList: true });
});

const h1 = () => p.$eval("#view h1", (e) => e.textContent.trim()).catch(() => "");
const ready = async () => { await p.waitForFunction(() => !document.querySelector("#view .loading, #view > .static-page") && document.querySelector("#view h1, #view .hero"), { timeout: 60000 }).catch(() => {}); await wait(400); };
const here = () => p.evaluate(() => location.pathname + location.search + location.hash);
const routeLinks = () => p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => /^#(home|sources|source|datasets|latest|papers|benchmarks|status|about|saved)\b/.test(h)));
const internal = () => p.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h.startsWith("/") && !h.startsWith("//")))]);

// 1. every kind of page, loaded directly
const direct = [
  ["/", null], ["/db/", "Databases"], ["/db/?field=proteins", null], ["/db/gnomad/", "gnomAD"], ["/datasets/", null], ["/datasets/?field=chemistry", null],
  ["/datasets/tape/", null], ["/papers/", null], ["/papers/top/", null], ["/benchmarks/", "Benchmarks"], ["/benchmarks/?field=chemistry", "Benchmarks"],
  ["/benchmarks/molecular-property-prediction-bbbp/", "Molecular Property Prediction"], ["/benchmarks/proteingym-zero-shot-substitutions/", null],
  ["/models/", null], ["/models/chembfn/", "ChemBFN"], ["/benchmarks/papers/", null], ["/status/", null], ["/about/", null], ["/saved/", null],
];
const allLinks = new Set();
for (const [url, want] of direct) {
  const res = await p.goto(SITE + url, { waitUntil: "domcontentloaded" });
  await ready();
  const title = await p.title();
  const head = await h1();
  ok(res.status() === 200, `${url} answers 200`);
  ok((await here()) === url, `${url} keeps its address (${await here()})`);
  if (url !== "/") ok(!(await p.evaluate(() => window.__sawLoading)), `${url}: the content stays in place while the page loads (no loading flash)`);
  ok(!want || head.includes(want), `${url} shows “${head.slice(0, 50)}”`);
  ok(url === "/" ? /^Aliquome/.test(title) : / \| Aliquome$/.test(title), `${url} title “${title.slice(0, 60)}”`);
  const canon = await p.$eval('link[rel="canonical"]', (e) => e.href);
  ok(canon === SITE + url.split("?")[0], `${url} canonical ${canon}`);
  const hashes = await routeLinks();
  ok(hashes.length === 0, `${url}: no #route links left (${hashes.slice(0, 3).join(" ")})`);
  if (url === "/db/gnomad/") ok(title === "gnomAD: all releases and download links | Aliquome", `the page landed on keeps its search title`);
  (await internal()).forEach((h) => allLinks.add(h));
}

// 2. every internal link shown by the interactive pages exists
let bad = [];
for (const h of allLinks) {
  const r = await fetch(SITE + h, { redirect: "manual" });
  if (r.status !== 200) bad.push(`${r.status} ${h}`);
}
ok(bad.length === 0, `${allLinks.size} internal links on the interactive pages answer 200 ${bad.slice(0, 5).join(", ")}`);

// 3. moving around without reloading
await p.goto(SITE + "/", { waitUntil: "domcontentloaded" });
await ready();
await p.evaluate(() => (window.__same = 1));
await p.click('.nav a[data-nav="sources"]');
await ready();
ok((await here()) === "/db/" && (await p.evaluate(() => window.__same)) === 1, `nav “Databases” goes to /db/ without reloading`);
ok(await p.$eval('.nav a[data-nav="sources"]', (a) => a.getAttribute("aria-current") === "page"), "the nav marks Databases");
const firstDb = await p.$eval('#view a[href^="/db/"][href$="/"]:not([href="/db/"])', (a) => a.getAttribute("href"));
await p.click(`#view a[href="${firstDb}"]`);
await ready();
ok((await here()) === firstDb && (await p.evaluate(() => window.__same)) === 1, `a database link goes to ${firstDb} without reloading`);
ok((await p.title()).endsWith("| Aliquome") && (await p.title()) !== "Databases | Aliquome", `the title follows: ${await p.title()}`);
await p.goBack(); await ready();
ok((await here()) === "/db/", `Back returns to /db/ (${await here()})`);
await p.goForward(); await ready();
ok((await here()) === firstDb, `Forward returns to ${firstDb}`);
await p.goBack(); await ready();
// a field filter writes its address, and the address restores it
const fieldBtn = await p.$('#view button[data-field]:not([data-field=""])');
if (fieldBtn) {
  const f = await p.evaluate((x) => x.dataset.field, fieldBtn);
  await fieldBtn.click(); await wait(400);
  ok((await here()) === `/db/?field=${f}`, `a field filter sets ${await here()}`);
  await p.reload({ waitUntil: "domcontentloaded" }); await ready();
  ok(await p.$eval(`#view button[data-field="${f}"]`, (x) => x.getAttribute("aria-pressed") === "true"), `reloading /db/?field=${f} keeps the filter`);
} else ok(false, "field buttons found on /db/");
// benchmarks: table -> model -> paper
await p.goto(SITE + "/benchmarks/molecular-property-prediction-bbbp/", { waitUntil: "domcontentloaded" }); await ready();
await p.evaluate(() => (window.__same = 2));
const model = await p.$eval('#view table a[href^="/models/"]', (a) => a.getAttribute("href"));
await p.click(`#view table a[href="${model}"]`); await ready();
ok((await here()) === model && (await p.evaluate(() => window.__same)) === 2, `a model link opens ${model} in place`);
const paper = await p.$('#view a[href^="/benchmarks/paper/"]');
if (paper) {
  const ph = await p.evaluate((a) => a.getAttribute("href"), paper);
  await paper.click(); await ready();
  ok((await here()) === ph, `a paper link opens ${ph}`);
  const r = await fetch(SITE + ph);
  ok(r.status === 200, `${ph} also loads directly`);
}
// links that open elsewhere are left alone
const ext = await p.$$eval('#view a[href^="http"]', (as) => as.length);
ok(ext > 0, `external links stay ordinary links (${ext})`);

// 4. search palette
await p.goto(SITE + "/", { waitUntil: "domcontentloaded" }); await ready();
await p.keyboard.down("Control"); await p.keyboard.press("k"); await p.keyboard.up("Control");
await wait(300);
await p.type("#palette-q", "gnomAD");
await wait(500);
await p.keyboard.press("Enter"); await ready();
ok((await here()) === "/db/gnomad/", `search “gnomAD” + Enter opens /db/gnomad/ (${await here()})`);

// 5. old #addresses
for (const [h, want] of [["/#source/gnomad", "/db/gnomad/"], ["/#benchmarks/model/chembfn", "/models/chembfn/"], ["/#datasets/proteins/TAPE", "/datasets/tape/"], ["/#latest", "/papers/"], ["/?t=1#benchmarks/molecular-property-prediction-bbbp", "/benchmarks/molecular-property-prediction-bbbp/"]]) {
  await p.goto(SITE + h, { waitUntil: "domcontentloaded" }); await ready();
  ok((await here()) === want, `old ${h} moves to ${await here()}`);
}
await p.evaluate(() => { location.hash = "#about"; }); await ready();
ok((await here()) === "/about/" && /atlas is built/i.test(await h1()), `changing the hash to #about on a page opens /about/`);

// 6. missing pages
const nf = await p.goto(SITE + "/no-such-page/", { waitUntil: "domcontentloaded" }); await ready();
ok(nf.status() === 404 && /Not found/.test(await h1()), `an unknown address answers 404 and says Not found`);
ok((await here()) === "/no-such-page/", "and keeps its address");
const nf2 = await p.goto(SITE + "/db/no-such-db/", { waitUntil: "domcontentloaded" }); await ready();
ok(nf2.status() === 404, `/db/no-such-db/ answers 404`);

// 7. without JavaScript: the content is in the page
const q = await b.newPage();
await q.setJavaScriptEnabled(false);
await q.goto(SITE + "/db/gnomad/", { waitUntil: "domcontentloaded" });
ok((await q.$eval("#view h1", (e) => e.textContent)) === "gnomAD" && (await q.$$("#view table tr")).length > 10, "without JavaScript /db/gnomad/ shows its name and every release");
await q.goto(SITE + "/benchmarks/molecular-property-prediction-bbbp/", { waitUntil: "domcontentloaded" });
ok((await q.$$("#view table tbody tr")).length > 20, "without JavaScript a benchmark page shows its results table");
await q.close();

// 8. phone width
await p.setViewport({ width: 380, height: 800 });
for (const url of ["/", "/db/gnomad/", "/benchmarks/molecular-property-prediction-bbbp/", "/models/chembfn/", "/datasets/tape/"]) {
  await p.goto(SITE + url, { waitUntil: "domcontentloaded" }); await ready();
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${url} fits a phone screen`);
}

const real = errors.filter((e) => !/no-such/.test(e));
ok(real.length === 0, `no errors in the browser (the two 404s asked for above aside) ${real.slice(0, 5).join(" | ")}`);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
server.close();
process.exit(fail ? 1 : 0);
