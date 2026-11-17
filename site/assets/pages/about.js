// #about
import { view, esc } from "../core/dom.js";
import { S, load } from "../core/store.js";

export function pageAbout() {
  const b = S.build || {};
  const inputs = Object.entries(b.inputs || {}).map(([k, v]) => `${v.slice(0, 16)}…  ${k}`).join("\n");
  view.innerHTML = `<div class="page"><section class="section">
    <h1>How the atlas is built</h1>
    <div class="prose">
      <p>The site is a set of static pages. A small Rust program, <code>aliquome</code>, reads five files kept in the repository and writes the JSON files these pages load. A GitHub Actions job runs it every two days, commits the new data and publishes the site.</p>
      <h2>What changes every two days</h2>
      <p><b>Papers.</b> For each field, two Europe PMC queries return the most cited open-access papers of all time and of the last 24 months. Each paper is tagged with tasks, from keyword patterns, and with the databases and datasets it names.</p>
      <p><b>New papers.</b> Every paper published in the last 60 days in the leading bioinformatics and computational biology journals is collected and sorted into fields and tasks. Nature, Science, Cell and Nature Communications are included only for computational papers. Abstracts are shown when the paper is open access or under a Creative Commons licence.</p>
      <p><b>Benchmarks.</b> Published results tables are downloaded and shown unchanged.</p>
      <p><b>Status.</b> Every source's website and the download link of its current release are requested once. Results are kept for 30 days.</p>
      <h2>Reproducing a build</h2>
      <p>Databases, releases and datasets come only from files in the repository, so a commit always gives the same <code>sources.json</code> and <code>datasets.json</code>. The scheduled job builds them twice with <code>aliquome build --offline</code> and stops if the two outputs differ. Every build records the commit and the SHA-256 of each input:</p>
      <div class="pre">built      ${esc(b.generated_at || "—")}
engine     ${esc(b.engine || "—")}
commit     ${esc(b.commit || "—")}
mode       ${esc(b.mode || "—")}
${esc(inputs)}</div>
      <p>For your own analyses, pin the exact release link from a database page and record its checksum. The “pooch” code tab does both.</p>
      <h2>Adding or fixing an entry</h2>
      <p>Add a block to <code>data/sources.toml</code> and rows to <code>data/database_versions.csv</code>, then open a pull request. No code change is needed.</p>
      <h2>Limits</h2>
      <p>Releases marked “?” come from prior knowledge and were not confirmed against the source. Licence text is a short indication, not legal advice. Task and dataset tags on papers are automatic.</p>
      <h2>Contact</h2>
      <p>For questions, corrections or a database to add, write to <a href="mailto:alikianfar0@gmail.com">alikianfar0@gmail.com</a> or open an issue on <a href="https://github.com/aliquome/aliquome.github.io/issues">GitHub</a>.</p>
    </div>
  </section></div>`;
}
