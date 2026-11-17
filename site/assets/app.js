// Bioinformatics Data Atlas: reads the JSON files in data/ and draws the pages.
// Routes live in the URL hash: #home, #sources[/field], #source/<id>,
// #datasets[/field[/name]], #papers[/field], #benchmarks[/board], #status, #about.
import { trace, requestThumb, mountLive, clearThumbs } from "./glyph.js";
import { mountCells } from "./cells.js";
import { saved, bibtex, manifest, downloadText, mountPalette } from "./library.js";

const view = document.getElementById("view");
const S = { fields: [], sources: [], datasets: [], papers: null, boards: null, status: null, build: null };
let stopLive = () => {};

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => Number(n || 0).toLocaleString("en-US");
const safe = (u) => (/^(https?|ftp):\/\//i.test(u || "") ? u : "");
const fieldOf = (id) => S.fields.find((f) => f.id === id) || { id, label: id, base: "A", shape: "network", tasks: [] };
const baseVar = (f) => `var(--base-${(f.base || "A").toLowerCase()})`;
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const STATE_LABEL = { ok: "Reachable", blocked: "Up, refuses automated checks", down: "Not reachable" };

function toast(text) {
  const t = document.getElementById("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1600);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
  } catch (e) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    try { document.execCommand("copy"); toast("Copied"); } catch (err) { toast("Select the text and copy it"); }
    area.remove();
  }
}

function licenceClass(text) {
  const t = (text || "").toLowerCase();
  if (/controlled/.test(t)) return "closed";
  if (/licen[cs]e required|commercial|paid|academic use only|non-commercial|-nc|by-nc|registration/.test(t)) return "limited";
  if (/open|public domain|cc0|cc by|mit/.test(t)) return "open";
  return "";
}

const statusOf = (id) => S.status?.sources?.[id] || null;
function dot(id) {
  const s = statusOf(id);
  const label = s ? STATE_LABEL[s.state] || s.state : "Not checked yet";
  return `<span class="dot ${s ? esc(s.state) : ""}" title="${esc(label)}" role="img" aria-label="${esc(label)}"></span>`;
}
function history(id) {
  const s = statusOf(id);
  if (!s?.history?.length) return `<span class="muted">No checks yet</span>`;
  return `<span class="history" role="img" aria-label="Daily checks, oldest first">${s.history
    .map((h) => `<i class="${esc(h.s)}" title="${esc(h.d)}: ${esc(STATE_LABEL[h.s] || h.s)}"></i>`)
    .join("")}</span>`;
}

// 3D stills are drawn only when they scroll near the viewport, one per idle slot.
const lazy = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { lazy.unobserve(e.target); requestThumb(e.target); } }),
  { rootMargin: "400px" }
);
const art = (name, field) =>
  `<img src="${BLANK}" alt="" data-name="${esc(name)}" data-shape="${esc(fieldOf(field).shape)}">`;
const armArt = () => view.querySelectorAll("img[data-name]:not(.ready)").forEach((img) => lazy.observe(img));

// ---------- download code ----------
const fileName = (url) => {
  const last = url.split("?")[0].replace(/\/+$/, "").split("/").pop() || "download";
  return last.includes("{") ? "download" : last;
};

// Record pages on data-hosting services are fetched with that service's own
// client or API, so they get code too, not only direct file links.
const HOSTS = {
  zenodo: /zenodo\.org\/(?:records?|deposit)\/(\d+)|10\.5281\/zenodo\.(\d+)/i,
  figsharecol: /figshare\.com\/collections\/(?:[^/]+\/)?(\d{5,})/i,
  mendeley: /data\.mendeley\.com\/datasets\/([a-z0-9]{10})(?:\/(\d+))?/i,
  figshare: /figshare\.com\/articles\/(?:[^/]+\/)*(\d{5,})|10\.6084\/m9\.figshare\.(\d+)/i,
  kaggle: /kaggle\.com\/(?:(datasets)\/([^/?#]+\/[^/?#]+)|(?:competitions|c)\/([^/?#]+))/i,
  gdrive: /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=|drive\/(?:u\/\d+\/)?folders\/)([\w-]{10,})/i,
  osf: /osf\.io\/([a-z0-9]{5})(?:\/|$)/i,
  synapse: /synapse\.org\/.*?(syn\d{4,})/i,
  geo: /ncbi\.nlm\.nih\.gov\/geo\/query\/acc\.cgi\?acc=(GSE\d+)/i,
  dataverse: /^(https?:\/\/(?:[^/]*dataverse[^/]*|edmond\.mpdl\.mpg\.de))\/dataset\.xhtml\?persistentId=(doi:[^&#]+)/i,
  dryad: /datadryad\.org\/(?:stash\/)?dataset\/doi:(10\.5061\/dryad\.[\w.]+)|doi\.org\/(10\.5061\/dryad\.[\w.]+)/i,
};
const hostOf = (url) => Object.keys(HOSTS).find((k) => HOSTS[k].test(url));
const hostId = (url, k) => (url.match(HOSTS[k]) || []).slice(1).filter(Boolean);

// A release stored as "portal" may still sit on a host with its own client.
const typeOf = (url, t) => (!t || t === "portal" || t === "none" ? inferType(url || "") : t);

function inferType(url) {
  if (/huggingface\.co\/datasets\//.test(url)) return "hf";
  const h = hostOf(url);
  if (h) return h;
  if (/^https?:\/\/(github\.com|gitlab\.com|gitee\.com|bitbucket\.org)\/[^/]+\/[^/]+?(\.git)?\/?$/.test(url)) return "git";
  if (/^https?:\/\/github\.com\/[^/]+\/[^/]+\/tree\/[^/]+\/.+/.test(url)) return "gitpath";
  if (/\.(gz|zip|tar|tgz|bz2|xz|zst|h5|h5ad|csv|tsv|json|jsonl|pkl|parquet|fasta|fa|faa|pdb|cif|txt|sdf|smi|npz|npy|pt|obo|owl|gaf|vcf|bed|gtf|gff3?|mat|rds|xlsx|tif|tiff)(\?|$)/i.test(url)) return "file";
  // folders on FTP servers and download areas list their files
  if (/\/$/.test(url) && /^https?:\/\/(ftp\.|[^/]+\/(?:[^?#]*\/)?(?:pub|download_area|downloads?|files|releases)\/)/.test(url)) return "directory";
  return "portal";
}

function snippets(url, type) {
  if (!url) return [];
  const f = fileName(url);
  const q = JSON.stringify(url);
  if (url.startsWith("s3://")) {
    const key = url.replace(/^s3:\/\/[^/]+\/?/, "");
    const b = url.replace(/^s3:\/\/([^/]+).*/, "$1");
    const isFile = type === "file";
    return [
      ["AWS CLI", isFile ? `aws s3 cp --no-sign-request ${q} .` : `aws s3 sync --no-sign-request ${q} ./${fileName(url)}`],
      ["Python", isFile
        ? `import boto3\nfrom botocore import UNSIGNED\nfrom botocore.config import Config\n\ns3 = boto3.client("s3", config=Config(signature_version=UNSIGNED))\ns3.download_file(${JSON.stringify(b)}, ${JSON.stringify(key)}, ${JSON.stringify(f)})`
        : `import boto3\nfrom botocore import UNSIGNED\nfrom botocore.config import Config\n\ns3 = boto3.client("s3", config=Config(signature_version=UNSIGNED))\npages = s3.get_paginator("list_objects_v2").paginate(Bucket=${JSON.stringify(b)}, Prefix=${JSON.stringify(key)})\nfor page in pages:\n    for obj in page.get("Contents", []):\n        print(obj["Key"], obj["Size"])`],
    ];
  }
  if (url.startsWith("gs://")) {
    return [
      ["gcloud", `gcloud storage cp --recursive ${q} .`],
      ["Python", `from google.cloud import storage\n\nclient = storage.Client.create_anonymous_client()\nbucket, _, prefix = ${q}[5:].partition("/")\nfor blob in client.list_blobs(bucket, prefix=prefix):\n    print(blob.name, blob.size)`],
    ];
  }
  if (type === "hf") {
    const repo = url.replace(/^https?:\/\/huggingface\.co\/datasets\//, "").split("/").slice(0, 2).join("/");
    return [
      ["hf CLI", `hf download ${repo} --repo-type dataset --local-dir ${repo.split("/")[1]}`],
      ["Python", `from huggingface_hub import snapshot_download\n\npath = snapshot_download(repo_id=${JSON.stringify(repo)}, repo_type="dataset")`],
      ["datasets", `from datasets import load_dataset\n\nds = load_dataset(${JSON.stringify(repo)})`],
    ];
  }
  if (type === "git") return [["git", `git clone --depth 1 ${url.replace(/\/$/, "")}`]];
  if (type === "gitpath") {
    const [, repo, branch, dir] = url.match(/^(https?:\/\/github\.com\/[^/]+\/[^/]+)\/tree\/([^/]+)\/(.+?)\/?$/);
    return [["git", `# only this folder of the repository\ngit clone --depth 1 --filter=blob:none --sparse --branch ${branch} ${repo}\ncd ${repo.split("/").pop()}\ngit sparse-checkout set ${dir}`]];
  }
  if (HOSTS[type]) {
    const [x, y] = hostId(url, type);
    const s = JSON.stringify;
    switch (type) {
      case "zenodo": return [
        ["zenodo_get", `pip install zenodo-get\nzenodo_get ${x}`],
        ["curl", `curl -s https://zenodo.org/api/records/${x} \\\n  | jq -r '.files[].links.self' \\\n  | xargs -n1 wget -c --content-disposition`],
        ["Python", `import requests, urllib.request\n\nrec = requests.get("https://zenodo.org/api/records/${x}", timeout=60).json()\nfor f in rec["files"]:\n    print(f["key"], f["size"], f["checksum"])\n    urllib.request.urlretrieve(f["links"]["self"], f["key"])`],
      ];
      case "figshare": return [
        ["curl", `curl -s https://api.figshare.com/v2/articles/${x}/files \\\n  | jq -r '.[].download_url' \\\n  | xargs -n1 wget -c --content-disposition`],
        ["Python", `import requests, urllib.request\n\nfiles = requests.get("https://api.figshare.com/v2/articles/${x}/files", timeout=60).json()\nfor f in files:\n    print(f["name"], f["size"], f["computed_md5"])\n    urllib.request.urlretrieve(f["download_url"], f["name"])`],
      ];
      case "figsharecol": return [
        ["curl", `# every article in the collection, then every file of each article\ncurl -s "https://api.figshare.com/v2/collections/${x}/articles?page_size=1000" | jq -r '.[].id' \\\n  | while read a; do curl -s "https://api.figshare.com/v2/articles/$a/files" | jq -r '.[].download_url'; done \\\n  | xargs -n1 wget -c --content-disposition`],
        ["Python", `import requests, urllib.request\n\napi = "https://api.figshare.com/v2"\nfor art in requests.get(f"{api}/collections/${x}/articles", params={"page_size": 1000}, timeout=60).json():\n    for f in requests.get(f"{api}/articles/{art['id']}/files", timeout=60).json():\n        print(art["title"], f["name"], f["size"])\n        urllib.request.urlretrieve(f["download_url"], f["name"])`],
      ];
      case "mendeley": {
        const v = y ? `?version=${y}` : "";
        return [
          ["curl", `curl -s "https://data.mendeley.com/public-api/datasets/${x}${v}" \\\n  | jq -r '.files[].content_details.download_url' \\\n  | xargs -n1 wget -c --content-disposition`],
          ["Python", `import requests, urllib.request\n\nds = requests.get("https://data.mendeley.com/public-api/datasets/${x}${v}", timeout=60).json()\nfor f in ds["files"]:\n    print(f["filename"], f["content_details"]["sha256_hash"])\n    urllib.request.urlretrieve(f["content_details"]["download_url"], f["filename"])`],
        ];
      }
      case "kaggle": return x === "datasets" ? [
        ["kaggle CLI", `pip install kaggle   # API token in ~/.kaggle/kaggle.json\nkaggle datasets download -d ${y} --unzip`],
        ["Python", `import kagglehub\n\npath = kagglehub.dataset_download(${s(y)})`],
      ] : [
        ["kaggle CLI", `pip install kaggle   # accept the competition rules on Kaggle first\nkaggle competitions download -c ${x}`],
        ["Python", `import kagglehub\n\npath = kagglehub.competition_download(${s(x)})`],
      ];
      case "gdrive": return /folders/.test(url) ? [
        ["gdown", `pip install gdown\ngdown --folder ${s(url)}`],
        ["Python", `import gdown\n\ngdown.download_folder(${s(url)})`],
      ] : [
        ["gdown", `pip install gdown\ngdown ${x}`],
        ["Python", `import gdown\n\npath = gdown.download(id=${s(x)})`],
      ];
      case "osf": return [
        ["osfclient", `pip install osfclient\nosf -p ${x} clone ./${x}`],
        ["Python", `import requests\n\nr = requests.get("https://api.osf.io/v2/nodes/${x}/files/osfstorage/", timeout=60).json()\nfor f in r["data"]:\n    print(f["attributes"]["name"], f["links"].get("download"))`],
      ];
      case "synapse": return [
        ["Synapse CLI", `pip install synapseclient   # free account and access token needed\nsynapse get -r ${x}`],
        ["Python", `import synapseclient, synapseutils\n\nsyn = synapseclient.login()\nfiles = synapseutils.syncFromSynapse(syn, ${s(x)}, path="./${x}")`],
        ["R", `# install.packages("synapser", repos = c("http://ran.synapse.org", "https://cloud.r-project.org"))\nlibrary(synapser)\nsynLogin()\nsynGet(${s(x)}, downloadLocation = ".")`],
      ];
      case "geo": {
        const stub = x.slice(0, -3) + "nnn";
        const suppl = `https://ftp.ncbi.nlm.nih.gov/geo/series/${stub}/${x}/suppl/`;
        return [
          ["R", `# BiocManager::install("GEOquery")\nlibrary(GEOquery)\ngse <- getGEO(${s(x)}, GSEMatrix = TRUE)\ngetGEOSuppFiles(${s(x)})`],
          ["Python", `import GEOparse   # pip install GEOparse\n\ngse = GEOparse.get_GEO(geo=${s(x)}, destdir=".")`],
          ["wget", `wget -r -np -nd -c -R "index.html*" ${suppl}`],
        ];
      }
      case "dataverse": return [
        ["curl", `# metadata and file list\ncurl -s "${x}/api/datasets/:persistentId/?persistentId=${y}"\n# every file as one zip\ncurl -L -o dataset.zip "${x}/api/access/dataset/:persistentId/?persistentId=${y}"`],
        ["Python", `import requests\n\nr = requests.get(${s(x + "/api/datasets/:persistentId/")}, params={"persistentId": ${s(y)}}, timeout=60).json()\nfor f in r["data"]["latestVersion"]["files"]:\n    print(f["dataFile"]["id"], f["dataFile"]["filename"])`],
      ];
      case "dryad": {
        const doi = encodeURIComponent("doi:" + x);
        return [
          ["curl", `curl -L -o dataset.zip "https://datadryad.org/api/v2/datasets/${doi}/download"`],
          ["Python", `import urllib.request\n\nurllib.request.urlretrieve("https://datadryad.org/api/v2/datasets/${doi}/download", "dataset.zip")`],
        ];
      }
    }
  }
  if (type === "api") {
    return [
      ["curl", `curl -s ${q}`],
      ["Python", `import requests\n\ndata = requests.get(${q}, timeout=60).json()`],
      ["R", `data <- jsonlite::fromJSON(${q})`],
    ];
  }
  if (type === "directory") {
    return [
      ["wget", `wget -r -np -nd -c -R "index.html*" ${q}`],
      ["curl", `# list the folder, then fetch the files you need\ncurl -s ${q}`],
      ["Python", `import re, urllib.request\n\nbase = ${q}\nhtml = urllib.request.urlopen(base).read().decode()\nfiles = sorted(set(re.findall(r'href="([^"?/][^"]*)"', html)))\nprint(files)`],
    ];
  }
  if (type === "file" || type === "pattern") {
    return [
      ["curl", `curl -L -C - -O ${q}`],
      ["wget", `wget -c ${q}`],
      ["Python", `import urllib.request\n\nurllib.request.urlretrieve(${q}, ${JSON.stringify(f)})`],
      ["pooch", `# downloads once, caches, and records the SHA-256 for reproducibility\nimport pooch\n\npath = pooch.retrieve(url=${q}, known_hash=None, progressbar=True)\nprint(pooch.file_hash(path))`],
      ["R", `download.file(${q}, destfile = ${JSON.stringify(f)}, mode = "wb")`],
    ];
  }
  return [];
}

// A loader is a library call or official client command from data/loaders.toml.
const loaderLink = (l, key, name) =>
  `${safe(l.docs) ? `<a href="${esc(l.docs)}" target="_blank" rel="noopener">${esc(l.label)}</a>` : `<span>${esc(l.label)}</span>`}<button type="button" data-loader="${esc(key)}" data-label="${esc(name + ", " + l.label)}">code</button>`;
function findLoader(key) {
  const [kind, id, i] = key.split(":");
  const host = kind === "ds" ? S.datasets.find((d) => d.id === id) : S.sources.find((s) => s.id === id);
  return host?.loaders?.[Number(i)];
}
function loaderPanel(l, title) {
  const id = `p${++panelSeq}`;
  return `<div class="get" data-panel="${id}">
    <div class="get-head"><span class="label">${esc(title)}</span><span class="hint">Runs the library or official client, which downloads the data for you.</span></div>
    <div class="code" data-pane="${id}-0"><div class="code-bar"><span>${esc(l.label)}</span><button class="btn small" type="button" data-copy-pre>Copy</button></div><pre>${esc(l.code)}</pre></div>
    ${safe(l.docs) ? `<p class="hint">Documentation: <a href="${esc(l.docs)}" target="_blank" rel="noopener">${esc(l.docs)}</a></p>` : ""}
  </div>`;
}

let panelSeq = 0;
function codePanel(url, type, title) {
  const tabs = snippets(url, type);
  const id = `p${++panelSeq}`;
  const open = safe(url) ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open</a>` : "";
  const isPattern = type === "pattern" || url.includes("{");
  return `<div class="get" data-panel="${id}">
    <div class="get-head"><span class="label">${esc(title || "Direct link")}</span><span class="hint">${
      isPattern ? "Replace the {placeholder} with the release you need." : type === "portal" ? "This source is a web portal; open it to choose files."
        : HOSTS[type] ? "Fetches every file of this record with the service’s own client or API." : "Use this link in your code to fetch exactly this release."
    }</span></div>
    <div class="url-line"><code>${esc(url)}</code><button class="btn solid" type="button" data-copy="${esc(url)}">Copy link</button>${open}</div>
    ${
      tabs.length
        ? `<div class="tabs" role="tablist">${tabs
            .map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-tab="${id}-${i}">${esc(t[0])}</button>`)
            .join("")}</div>
           ${tabs
             .map(
               (t, i) => `<div class="code" data-pane="${id}-${i}" ${i ? "hidden" : ""}><div class="code-bar"><span>${esc(t[0])}</span><button class="btn small" type="button" data-copy-pre>Copy</button></div><pre>${esc(t[1])}</pre></div>`
             )
             .join("")}`
        : ""
    }
  </div>`;
}

// One listener for every copy button, tab and code toggle on every page.
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-copy]");
  if (c) return copy(c.dataset.copy);
  const pre = e.target.closest("[data-copy-pre]");
  if (pre) return copy(pre.closest(".code").querySelector("pre").textContent);
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    const panel = tab.closest(".get");
    panel.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === tab)));
    panel.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab.dataset.tab));
    return;
  }
  const lt = e.target.closest("[data-loader]");
  if (lt) {
    const l = findLoader(lt.dataset.loader);
    const host = lt.closest(".row-main");
    if (!l || !host) return;
    const existing = host.querySelector(".get");
    if (existing && existing.dataset.for === lt.dataset.loader) { existing.remove(); return; }
    existing?.remove();
    host.insertAdjacentHTML("beforeend", loaderPanel(l, lt.dataset.label));
    host.lastElementChild.dataset.for = lt.dataset.loader;
    return;
  }
  const toggle = e.target.closest("[data-code]");
  if (toggle) {
    const host = toggle.closest(".row-main");
    const existing = host.querySelector(".get");
    if (existing && existing.dataset.for === toggle.dataset.code) { existing.remove(); return; }
    existing?.remove();
    host.insertAdjacentHTML("beforeend", codePanel(toggle.dataset.code, toggle.dataset.type, toggle.dataset.label));
    host.lastElementChild.dataset.for = toggle.dataset.code;
  }
});

// ---------- shared pieces ----------
// The field filter is drawn as an electrophoresis gel: one lane per field,
// a marker ladder for "All", and a glowing band whose thickness and
// migration follow how many entries the field holds.
//   gel({ id, active, counts, unit, search, link })
//   link: optional (fieldId) => href, turns lanes into links instead of buttons
function gel({ id, active = "", counts, unit = "entries", search, link, total: given }) {
  const fields = S.fields.filter((f) => counts[f.id]);
  // Papers can sit in several fields, so the caller may pass the real total.
  const total = given ?? Object.values(counts).reduce((a, n) => a + n, 0);
  const max = Math.max(1, ...fields.map((f) => counts[f.id]));
  const lane = (f) => {
    const n = counts[f.id];
    const pos = 14 + (1 - Math.log(n + 1) / Math.log(max + 1)) * 58;
    const thick = 4 + Math.round((n / max) * 9);
    const tag = link ? "a" : "button";
    const attrs = link
      ? `href="${esc(link(f.id))}" ${active === f.id ? 'aria-current="true"' : ""}`
      : `type="button" data-field="${esc(f.id)}" aria-pressed="${active === f.id}"`;
    return `<${tag} class="lane" ${attrs} data-label="${esc(f.label)}" data-n="${n}" style="--dot:${baseVar(f)};--pos:${pos.toFixed(1)}%;--thick:${thick}px">
      <span class="well" aria-hidden="true"></span>
      <span class="track" aria-hidden="true"><i class="band"></i></span>
      <span class="lane-label">${esc(f.label)}</span><span class="lane-n">${num(n)}</span>
    </${tag}>`;
  };
  const ladder = link
    ? ""
    : `<button class="lane ladder" type="button" data-field="" aria-pressed="${!active}" data-label="All fields" data-n="${total}">
      <span class="well" aria-hidden="true"></span>
      <span class="track" aria-hidden="true">${[12, 22, 30, 38, 47, 58, 70, 82].map((p) => `<i class="band" style="--pos:${p}%"></i>`).join("")}</span>
      <span class="lane-label">All fields</span><span class="lane-n">${num(total)}</span>
    </button>`;
  const current = active ? fields.find((f) => f.id === active) : null;
  return `<div class="gel">
    <div class="gel-head">
      <p class="gel-readout"><span class="label">Field</span> <b data-readout>${esc(current ? current.label : "All fields")}</b> <span class="muted" data-readout-n>${num(current ? counts[current.id] : total)} ${esc(unit)}</span></p>
      ${search ? `<label class="gel-search" for="${esc(search.id)}"><svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 12l4.5 4.5" stroke="currentColor" stroke-width="1.6"/></svg><input id="${esc(search.id)}" type="search" placeholder="${esc(search.placeholder)}" value="${esc(search.value || "")}" aria-label="${esc(search.placeholder)}"></label>` : ""}
    </div>
    <div class="gel-slab" id="${esc(id)}" role="group" aria-label="Filter by field">${ladder}${fields.map(lane).join("")}</div>
  </div>`;
}

// Keep the gel's readout in step with the selected lane.
document.addEventListener("click", (e) => {
  const lane = e.target.closest(".gel .lane");
  if (!lane || lane.tagName === "A") return;
  const g = lane.closest(".gel");
  g.querySelector("[data-readout]").textContent = lane.dataset.label;
  const unit = g.querySelector("[data-readout-n]").textContent.replace(/^[\d,]+\s*/, "");
  g.querySelector("[data-readout-n]").textContent = `${num(lane.dataset.n)} ${unit}`;
});

function replaceHash(hash) {
  try { window.history.replaceState(null, "", hash); } catch (e) { /* sandboxed */ }
}

// ---------- saved items ----------
// Papers are kept in a lookup so a save button can store the full record.
const paperIndex = new Map();
function saveItem(kind, id) {
  if (kind === "db") {
    const s = S.sources.find((x) => x.id === id);
    return s && { key: `db:${id}`, type: "database", title: s.name, version: s.latest, url: s.latest_url, href: `#source/${id}` };
  }
  if (kind === "ds") {
    const d = S.datasets.find((x) => x.id === id);
    return d && { key: `ds:${id}`, type: "dataset", title: d.name, version: d.versions || "", url: d.links[0]?.url || d.repo, href: `#datasets/${d.field}/${encodeURIComponent(d.name)}` };
  }
  const p = paperIndex.get(id);
  return p && { key: `pp:${id}`, type: "paper", title: p.title, url: p.url, href: p.url, paper: p };
}
function saveBtn(kind, id, label = "") {
  const on = saved.has(`${kind}:${id}`);
  return `<button class="save ${label ? "with-label" : ""}" type="button" data-save="${esc(kind)}|${esc(id)}" aria-pressed="${on}" aria-label="${on ? "Remove from saved" : "Save"}">
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h8v12.4L8 11.2l-4 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>${label ? `<span>${on ? "Saved" : esc(label)}</span>` : ""}</button>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-save]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const [kind, id] = b.dataset.save.split("|");
  const item = saveItem(kind, id);
  if (!item) return;
  const on = saved.toggle(item);
  document.querySelectorAll(`[data-save="${CSS.escape(b.dataset.save)}"]`).forEach((x) => {
    x.setAttribute("aria-pressed", String(on));
    x.setAttribute("aria-label", on ? "Remove from saved" : "Save");
    const span = x.querySelector("span");
    if (span) span.textContent = on ? "Saved" : "Save";
  });
  toast(on ? "Saved. Find it under the bookmark icon." : "Removed from saved");
});
function updateSavedCount() {
  const n = saved.all().length;
  const el = document.getElementById("saved-n");
  el.textContent = n;
  el.hidden = n === 0;
}
saved.onChange(updateSavedCount);

function sourceCard(s) {
  return `<li class="db-row">
    <a class="db-link" href="#source/${esc(s.id)}">
      <span class="db-art">${art(s.name, s.field)}</span>
      <span class="db-main"><h3 class="db-name">${esc(s.name)}</h3>${trace(s.name)}<span class="db-sum">${esc(s.summary)}</span></span>
      <span class="db-rel"><span class="label">Current</span><span class="mono">${esc(s.latest) || "—"}</span></span>
      <span class="db-count"><span class="label">Releases</span><span class="num">${s.versions.length}</span></span>
    </a>${saveBtn("db", s.id)}</li>`;
}

const dsName = (key) => {
  const [kind, id] = key.split(":");
  if (kind === "db") return S.sources.find((s) => s.id === id)?.name || id;
  return S.datasets.find((d) => d.id === id)?.name || id;
};
const dsHref = (key) => {
  const [kind, id] = key.split(":");
  if (kind === "db") return `#source/${id}`;
  const d = S.datasets.find((x) => x.id === id);
  return d ? `#datasets/${d.field}/${encodeURIComponent(d.name)}` : "#datasets";
};
// One tag per visible name: a database and a dataset can share a name.
const uniqueByName = (keys) => {
  const seen = new Set();
  return keys.filter((k) => { const n = dsName(k).toLowerCase(); if (seen.has(n)) return false; seen.add(n); return true; });
};
// Task ids are "task" inside a field list, or "field:task" in the latest feed.
const taskLabel = (field, id) => {
  const [f, t] = id.includes(":") ? id.split(":") : [field, id];
  return fieldOf(f).tasks?.find((x) => x.id === t)?.label || t;
};
const prettyDate = (d) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

// The first ~400 characters, ended at a word.
const cut = (text) => text.slice(0, 400).replace(/s+S*$/, "") + "…";

function paperCard(p, field, open = false) {
  paperIndex.set(p.id, p);
  const authors = p.authors.length > 170 ? p.authors.slice(0, 170).replace(/,[^,]*$/, "") + ", et al." : p.authors;
  const fieldTags = (p.fields || []).map((id) => {
    const f = fieldOf(id);
    return `<a class="tag field" style="--dot:${baseVar(f)}" href="#latest/${esc(id)}">${esc(f.label)}</a>`;
  }).join("");
  return `<article class="paper"><div class="paper-text">
    <h3><a href="${esc(safe(p.url))}" target="_blank" rel="noopener">${esc(p.title)}</a></h3>
    <p class="who">${esc(authors)}</p>
    ${p.abstract
      ? `<p class="abstract" lang="en" data-paper="${esc(p.id)}">${esc(open || p.abstract.length <= 420 ? p.abstract : cut(p.abstract))}</p>
    ${p.abstract.length > 420 ? `<button class="more" type="button" data-more>${open ? "Show less" : "Read the full abstract"}</button>` : ""}`
      : `<p class="hint">The abstract of this paper is not openly licensed. Read it on the publisher’s page.</p>`}
    </div><div class="paper-side">
    <p class="meta"><span class="journal">${esc(p.journal || "—")}</span><span>${esc(p.fields ? prettyDate(p.date) : p.year)}</span>${
      p.cited ? `<span>cited ${num(p.cited)}×</span>` : ""}${
      p.license ? `<span>${esc(p.license.toUpperCase())}</span>` : ""
    }${p.lists?.includes("recent") ? `<span class="status latest">recent</span>` : ""}</p>
    ${
      fieldTags || p.tasks?.length || p.datasets?.length
        ? `<div class="tags">${fieldTags}${(p.tasks || []).map((t) => `<span class="tag task">${esc(taskLabel(field, t))}</span>`).join("")}${uniqueByName(p.datasets || [])
            .map((d) => `<a class="tag ds" href="${esc(dsHref(d))}">${esc(dsName(d))}</a>`)
            .join("")}</div>`
        : ""
    }
    <div class="links">${safe(p.url) ? `<a class="btn small" href="${esc(p.url)}" target="_blank" rel="noopener">Article</a>` : ""}${
      safe(p.pdf) ? `<a class="btn small" href="${esc(p.pdf)}" target="_blank" rel="noopener">PDF</a>` : ""
    }<button class="btn small" type="button" data-cite="${esc(p.id)}">Cite (BibTeX)</button>${saveBtn("pp", p.id, "Save")}</div>
  </div></article>`;
}
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-cite]");
  if (c && paperIndex.has(c.dataset.cite)) copy(bibtex(paperIndex.get(c.dataset.cite)));
});
document.addEventListener("click", (e) => {
  const more = e.target.closest("[data-more]");
  if (!more) return;
  const abs = more.parentElement.querySelector(".abstract");
  const p = paperIndex.get(abs.dataset.paper);
  if (!p) return;
  const opened = more.textContent.startsWith("Read");
  abs.textContent = opened ? p.abstract : cut(p.abstract);
  more.textContent = opened ? "Show less" : "Read the full abstract";
});

async function need(name) {
  if (S[name]) return S[name];
  const file = name === "boards" ? "leaderboards" : name;
  try { S[name] = await load(file); } catch (e) { S[name] = null; }
  if (name === "latest") searchIndex = null;
  return S[name];
}

// ---------- pages ----------
async function pageHome() {
  const day = Math.floor(Date.now() / 864e5);
  const featured = S.sources[day % S.sources.length];
  const f = fieldOf(featured.field);
  const checked = Object.values(S.status?.sources || {});
  const up = checked.filter((s) => s.state !== "down").length;
  const versions = S.sources.reduce((a, s) => a + s.versions.length, 0);
  const linked = S.sources.reduce((a, s) => a + s.versions.filter((v) => /^(https?|ftp|s3|gs):/.test(v.url)).length, 0);

  view.innerHTML = `<div class="page">
  <section class="section hero">
    <canvas class="cells" id="cells" aria-hidden="true"></canvas>
    <div class="hero-copy">
      <h1>Every release, one link away</h1>
      <p class="lede">Exact versions of ${S.sources.length} databases, ready to paste into your code.</p>
      <button class="search hero-search" type="button" data-open-search>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 12l4.5 4.5" stroke="currentColor" stroke-width="1.6"/></svg>
        <span>Search a database, a release, a dataset or a paper</span>
        <kbd>/</kbd>
      </button>
      <p class="try"><span class="muted">Try</span>${["GRCh38", "Ensembl 116", "gnomAD", "AlphaFold", "ChEMBL"]
        .map((t) => `<button class="tag" type="button" data-search-for="${esc(t)}">${esc(t)}</button>`).join("")}</p>
    </div>
    <div class="stage">
      <canvas id="stage" aria-label="3D figure generated from the name ${esc(featured.name)}"></canvas>
      <div class="stage-tag">
        <span><span class="label">Database of the day</span><br><a href="#source/${esc(featured.id)}">${esc(featured.name)}</a></span>
        <small>Drag to turn</small>
      </div>
    </div>
  </section>

  <section class="section ledger" aria-label="The atlas today">
    <dl class="figures">
      <div><dt>Databases</dt><dd class="num">${num(S.sources.length)}</dd></div>
      <div><dt>Releases tracked</dt><dd class="num">${num(versions)}</dd></div>
      <div><dt>With a direct link</dt><dd class="num">${num(linked)}</dd></div>
      <div><dt>Datasets</dt><dd class="num">${num(S.datasets.length)}</dd></div>
      ${checked.length ? "" : "<!-- status cell appears after the first daily check -->"}<div ${checked.length ? "" : "hidden"}><dt>Sources up today</dt><dd class="num">${up} of ${checked.length}</dd></div>
    </dl>
  </section>

  <section class="section actions">
    <a class="action" href="#sources" style="--dot:var(--base-a)"><b>Pin a database release</b><span>${num(S.sources.length)} databases, every version with its own link</span></a>
    <a class="action" href="#datasets" style="--dot:var(--base-c)"><b>Find a training set</b><span>${num(S.datasets.length)} datasets and benchmarks, with download code</span></a>
    <a class="action" href="#latest" style="--dot:var(--base-g)"><b>Read this month’s methods</b><span>Bioinformatics, NAR, Nature Methods and more</span></a>
    <a class="action" href="#benchmarks" style="--dot:var(--base-t)"><b>Rank protein models</b><span>ProteinGym results as published</span></a>
  </section>

  <section class="section">
    <div class="section-head"><h2>Databases by field</h2><a href="#sources">All databases</a></div>
    ${gel({ id: "home-gel", counts: Object.fromEntries(S.fields.map((x) => [x.id, S.sources.filter((s) => s.field === x.id).length])), unit: "databases", link: (id) => `#sources/${id}` })}
    <ul class="field-index">${S.fields.map((x) => `<li style="--dot:${baseVar(x)}"><h3>${esc(x.label)}</h3><p class="field-links"><a href="#sources/${esc(x.id)}">${S.sources.filter((s) => s.field === x.id).length} databases</a><a href="#datasets/${esc(x.id)}">${S.datasets.filter((d) => d.field === x.id).length} datasets</a><a href="#latest/${esc(x.id)}" data-latest-count="${esc(x.id)}">New papers</a></p></li>`).join("")}</ul>
  </section>

  <section class="section" id="home-latest"></section>

  <section class="section">
    <div class="section-head"><h2>Recently released</h2><a href="#sources">All databases</a></div>
    <ul class="db-list compact">${[...S.sources]
      .filter((s) => /^\d{4}-\d{2}/.test(s.latest_date))
      .sort((a, b) => b.latest_date.localeCompare(a.latest_date))
      .slice(0, 4)
      .map(sourceCard)
      .join("")}</ul>
  </section>

  <section class="section" id="home-board"></section>
  </div>`;

  const stop3d = mountLive(document.getElementById("stage"), featured.name, f.shape);
  const stopCells = mountCells(document.getElementById("cells"));
  stopLive = () => { stop3d(); stopCells(); };
  view.querySelectorAll("[data-open-search]").forEach((b) => b.addEventListener("click", () => palette.open()));
  view.querySelectorAll("[data-search-for]").forEach((b) => b.addEventListener("click", () => palette.open(b.dataset.searchFor)));
  armArt();

  const latest = await need("latest");
  const lslot = document.getElementById("home-latest");
  if (latest?.papers?.length && lslot) {
    const counts = {};
    latest.papers.forEach((p) => p.fields?.forEach((fid) => (counts[fid] = (counts[fid] || 0) + 1)));
    document.querySelectorAll("[data-latest-count]").forEach((el) => (el.textContent = `${counts[el.dataset.latestCount] || 0} new papers`));
    const fresh = latest.papers.filter((p) => p.abstract).slice(0, 4);
    lslot.innerHTML = `<div class="section-head"><h2>New in the journals</h2><a href="#latest">${num(latest.papers.length)} papers in the last ${latest.days} days</a></div>
      <div class="paper-list">${fresh.map((p) => paperCard(p, "")).join("")}</div>`;
  }

  const boards = await need("boards");
  const b = boards?.boards?.[0];
  const slot = document.getElementById("home-board");
  if (b && slot) {
    slot.innerHTML = `<div class="section-head"><h2>Top models on ${esc(b.title.split(":")[0])}</h2><a href="#benchmarks/${esc(b.id)}">Full comparison</a></div>
      ${boardTable(b, b.rows.slice(0, 5), false)}`;
  }
}

// ---------- site-wide search ----------
// Built once from the loaded data; papers join when their files arrive.
let searchIndex = null;
function buildIndex() {
  const idx = [
    ["Databases", "Every release with a direct link", "#sources"],
    ["Datasets", "Benchmarks and training data", "#datasets"],
    ["New papers", "Last 60 days in the leading journals", "#latest"],
    ["Most cited papers", "By field, all time and last 24 months", "#papers"],
    ["Benchmarks", "Published model comparisons", "#benchmarks"],
    ["Saved items", "Your reading list and data manifest", "#saved"],
    ["Source status", "Daily reachability checks", "#status"],
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
  return idx;
}
const palette = mountPalette(() => searchIndex || buildIndex(), esc);

function pageSources(field) {
  const counts = {};
  S.sources.forEach((s) => (counts[s.field] = (counts[s.field] || 0) + 1));
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Databases</h1>
    <p class="lede">Open a database to see every release with a direct link and ready-to-run download code. Each figure and trace is generated from the database name.</p>
    ${gel({ id: "chips", active: field, counts, unit: "databases", search: { id: "filter", placeholder: "Filter by name or release" } })}
    <ul class="db-list" id="grid"></ul>
  </section></div>`;
  let active = field || "";
  const grid = document.getElementById("grid");
  const filter = document.getElementById("filter");
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const list = S.sources.filter((s) => (!active || s.field === active) &&
      (!term || s.name.toLowerCase().includes(term) || s.versions.some((v) => v.version.toLowerCase().includes(term))));
    grid.innerHTML = list.length ? list.map(sourceCard).join("") : `<li class="note">No database matches this filter.</li>`;
    armArt();
  };
  document.getElementById("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-field]");
    if (!b) return;
    active = b.dataset.field;
    replaceHash(active ? `#sources/${active}` : "#sources");
    document.querySelectorAll("#chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  filter.addEventListener("input", draw);
  draw();
}

function pageSource(id) {
  const s = S.sources.find((x) => x.id === id);
  if (!s) return notFound("That database is not in the atlas.");
  const f = fieldOf(s.field);
  const st = statusOf(s.id);
  const link = S.status?.links?.[s.id];
  const rows = [...s.versions].reverse();
  const related = S.datasets.filter((d) => d.field === s.field).slice(0, 5);
  view.innerHTML = `<div class="page">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="#sources">Databases</a><span aria-hidden="true">/</span><a href="#sources/${esc(s.field)}">${esc(f.label)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(s.name)}</span></nav>
  <section class="detail">
    <div class="stage"><canvas id="stage" aria-label="3D figure generated from the name ${esc(s.name)}"></canvas>
      <div class="stage-tag"><small>Drag to turn the model</small></div></div>
    <div class="detail-info">
      <p class="field-name" style="--dot:${baseVar(f)}">${esc(f.label)}</p>
      <h1>${esc(s.name)}</h1>
      ${trace(s.name, 44)}
      <p class="lede">${esc(s.summary)}</p>
      <div class="detail-actions">${s.latest_url ? `<a class="btn solid" href="#get-current">Get the current release</a>` : ""}<a class="btn" href="#all-releases">All ${s.versions.length} releases</a>${saveBtn("db", s.id, "Save")}</div>
      <dl class="facts">
        <dt>Current release</dt><dd><b>${esc(s.latest) || "—"}</b> <span class="muted">${esc(s.latest_date)}</span></dd>
        <dt>Releases tracked</dt><dd>${s.versions.length}</dd>
        <dt>Licence</dt><dd><span class="badge ${licenceClass(s.license)}">${esc(s.license)}</span></dd>
        <dt>Website</dt><dd><a href="${esc(safe(s.homepage))}" target="_blank" rel="noopener">${esc(s.homepage)}</a></dd>
        <dt>Status today</dt><dd>${dot(s.id)} ${st ? `${esc(STATE_LABEL[st.state] || st.state)} <span class="muted">HTTP ${st.code || "—"}, ${st.ms} ms</span>` : `<span class="muted">Not checked yet</span>`}</dd>
        <dt>Download link</dt><dd>${link ? `${dot("")} ${link.state === "ok" ? "Answered today" : esc(STATE_LABEL[link.state] || link.state)} <span class="muted mono">HTTP ${link.code || "—"}</span>` : `<span class="muted">Not checked yet</span>`}</dd>
        <dt>Last 30 checks</dt><dd>${history(s.id)}</dd>
      </dl>
    </div>
  </section>

  ${s.latest_url ? `<section class="section" data-anchor="get-current"><h2>Get the current release</h2>${codePanel(s.latest_url, typeOf(s.latest_url, s.latest_url_type), `Release ${s.latest}`)}</section>` : ""}
  ${s.loaders?.length ? `<section class="section" data-anchor="get-code"><h2>Access in code</h2>${s.loaders.map((l) => loaderPanel(l, l.label)).join("")}</section>` : ""}

  <section class="section" data-anchor="all-releases">
    <div class="section-head"><h2>All releases</h2><span class="hint">Newest first. ✓ confirmed against the source; ? from prior knowledge.</span></div>
    <div class="toolbar">
      <label class="gel-search" for="relq"><svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 12l4.5 4.5" stroke="currentColor" stroke-width="1.6"/></svg><input id="relq" type="search" placeholder="Find a release, e.g. ${esc(s.versions[0]?.version || "")}"></label>
      <label class="check"><input type="checkbox" id="rellinked"> Only releases with a direct link</label>
    </div>
    <div class="table-wrap"><table class="releases">
      <thead><tr><th>Release</th><th>Date</th><th>Status</th><th>Direct link</th><th></th><th>Checked</th></tr></thead>
      <tbody>${rows
        .map((v, i) => {
          const usable = /^(https?|ftp|s3|gs):/.test(v.url);
          return `<tr data-relrow="${i}" data-linked="${usable}" data-text="${esc(`${v.version} ${v.date} ${v.note}`.toLowerCase())}">
            <td><b>${esc(v.version)}</b>${v.note ? `<br><span class="hint">${esc(v.note)}</span>` : ""}</td>
            <td class="mono nowrap">${esc(v.date) || "—"}</td>
            <td><span class="status ${esc(v.status)}">${esc(v.status || "—")}</span></td>
            <td class="url">${v.url ? esc(v.url) : `<span class="muted">—</span>`}</td>
            <td class="nowrap">${usable ? `<button class="btn small" type="button" data-copy="${esc(v.url)}">Copy</button> <button class="btn small" type="button" data-rel="${i}">Code</button>` : ""}</td>
            <td>${v.verified ? "✓" : "?"}</td></tr>
            <tr data-relpanel="${i}" hidden><td colspan="6"></td></tr>`;
        })
        .join("")}</tbody>
    </table></div>
  </section>

  ${related.length ? `<section class="section"><div class="section-head"><h2>Datasets in ${esc(f.label.toLowerCase())}</h2><a href="#datasets/${esc(s.field)}">All datasets in this field</a></div>
     <div class="rows">${related.map(datasetRow).join("")}</div></section>` : ""}
  <section class="section"><div class="chips"><a class="chip" style="--dot:${baseVar(f)}" href="#papers/${esc(s.field)}">Papers in ${esc(f.label)}</a></div></section>
  </div>`;
  const filterReleases = () => {
    const q = document.getElementById("relq").value.trim().toLowerCase();
    const linkedOnly = document.getElementById("rellinked").checked;
    view.querySelectorAll("[data-relrow]").forEach((tr) => {
      const show = (!q || tr.dataset.text.includes(q)) && (!linkedOnly || tr.dataset.linked === "true");
      tr.hidden = !show;
      if (!show) view.querySelector(`[data-relpanel="${tr.dataset.relrow}"]`).hidden = true;
    });
  };
  ["relq", "rellinked"].forEach((x) => document.getElementById(x).addEventListener("input", filterReleases));
  // In-page jumps without changing the route.
  view.querySelectorAll('a[href="#get-current"], a[href="#all-releases"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      view.querySelector(`[data-anchor="${a.getAttribute("href").slice(1)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
  view.querySelectorAll("[data-rel]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.rel);
      const row = view.querySelector(`[data-relpanel="${i}"]`);
      if (!row.hidden) { row.hidden = true; return; }
      const v = rows[i];
      row.firstElementChild.innerHTML = codePanel(v.url, typeOf(v.url, v.url_type), `${s.name} ${v.version}`);
      row.hidden = false;
    })
  );
  stopLive = mountLive(document.getElementById("stage"), s.name, f.shape);
  armArt();
}

function datasetRow(d) {
  const links = [...(safe(d.repo) ? [{ label: "Repository", url: d.repo }] : []), ...d.links.filter((l) => safe(l.url))];
  const facts = [d.versions && `Versions: ${d.versions}`, d.license && `Licence: ${d.license}`, d.paper_count && `Used by ${d.paper_count} papers`]
    .filter(Boolean).join(". ");
  return `<article class="row">
    <span class="row-art">${art(d.name, d.field)}</span>
    <div class="row-main">
      <h3>${esc(d.name)}</h3>
      ${d.description ? `<p>${esc(d.description)}</p>` : ""}
      ${facts ? `<p class="hint">${esc(facts)}</p>` : ""}
      ${d.access ? `<p class="mono hint">${esc(d.access)}</p>` : ""}
      ${links.length || d.loaders?.length ? `<div class="row-links">${(d.loaders || []).map((l, i) => loaderLink(l, `ds:${d.id}:${i}`, d.name)).join("")}${links.slice(0, 8).map((l) => {
        const type = inferType(l.url);
        return `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>${
          type !== "portal" ? `<button type="button" data-code="${esc(l.url)}" data-type="${type}" data-label="${esc(d.name + ", " + l.label)}">code</button>` : ""}`;
      }).join("")}</div>` : ""}
    </div>
    <div class="row-side"><span class="stars">${d.stars != null ? `★ ${num(d.stars)}` : ""}</span>${saveBtn("ds", d.id)}</div>
  </article>`;
}

function pageDatasets(field, preset) {
  const counts = {};
  S.datasets.forEach((d) => (counts[d.field] = (counts[d.field] || 0) + 1));
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Datasets and benchmarks</h1>
    <p class="lede">Press “code” next to a link to get a download snippet for your language.</p>
    ${gel({ id: "chips", active: field, counts, unit: "datasets", search: { id: "filter", placeholder: "Filter by name or description", value: preset } })}
    <p class="count" id="count"></p>
    <div class="rows" id="rows"></div>
    <div class="more-row"><button class="btn" type="button" id="dsmore" hidden>Show more datasets</button></div>
  </section></div>`;
  let active = field || "";
  let shown = 30;
  const rows = document.getElementById("rows");
  const filter = document.getElementById("filter");
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const list = S.datasets
      .filter((d) => (!active || d.field === active) && (!term || d.name.toLowerCase().includes(term) || d.description.toLowerCase().includes(term)))
      .sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || (b.paper_count ?? 0) - (a.paper_count ?? 0));
    document.getElementById("count").textContent = `${list.length} of ${S.datasets.length} datasets`;
    rows.innerHTML = list.length ? list.slice(0, shown).map(datasetRow).join("") : `<p class="note">No dataset matches this filter.</p>`;
    document.getElementById("dsmore").hidden = list.length <= shown;
    armArt();
  };
  document.getElementById("dsmore").addEventListener("click", () => { shown += 30; draw(); });
  filter.addEventListener("input", () => { shown = 30; });
  document.getElementById("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-field]");
    if (!b) return;
    active = b.dataset.field;
    replaceHash(active ? `#datasets/${active}` : "#datasets");
    document.querySelectorAll("#chips button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  filter.addEventListener("input", draw);
  draw();
}

const paperTabs = (on) => `<nav class="tabbar" aria-label="Paper views"><a href="#latest" ${on === "latest" ? "aria-current=\"page\"" : ""}>New papers <small>last 60 days</small></a><a href="#papers" ${on === "top" ? "aria-current=\"page\"" : ""}>Most cited <small>all time and recent</small></a></nav>`;

async function pageLatest(fieldId, preset = "") {
  view.innerHTML = `<div class="page"><p class="loading">Loading new papers…</p></div>`;
  const data = await need("latest");
  if (!data?.papers?.length) return (view.innerHTML = `<div class="page"><p class="note">New papers have not been fetched yet. The daily job fills this page.</p></div>`);
  const all = data.papers;
  const counts = {};
  all.forEach((p) => p.fields?.forEach((f) => (counts[f] = (counts[f] || 0) + 1)));
  const journals = [...new Set(all.map((p) => p.journal).filter(Boolean))].sort();
  const st = { field: S.fields.some((f) => f.id === fieldId) ? fieldId : "", days: 0, shown: 30 };

  view.innerHTML = `<div class="page"><section class="section">
    
    <h1>Papers</h1>
    ${paperTabs("latest")}
    <p class="lede">Every paper published in the last ${data.days} days in the leading bioinformatics and computational biology journals, newest first. Each one is sorted into fields and tasks so you can follow only what matters to your work.</p>
    ${gel({ id: "lfields", active: st.field, counts, unit: "papers", total: all.length })}
    <div class="controls">
      <div class="control"><label for="lq">Search</label><input class="input" id="lq" type="search" placeholder="Title, method, keyword, author"></div>
      <div class="control"><label for="ltask">Task</label><select class="input" id="ltask"></select></div>
      <div class="control"><label for="ljour">Journal</label><select class="input" id="ljour"><option value="">All journals</option>${journals.map((j) => `<option>${esc(j)}</option>`).join("")}</select></div>
      <div class="control"><label for="lsort">Sort by</label><select class="input" id="lsort"><option value="date">Newest first</option><option value="cited">Most cited so far</option></select></div>
    </div>
    <div class="toolbar">
      <div class="seg" id="ldays"><button type="button" data-days="0" aria-pressed="true">${data.days} days</button><button type="button" data-days="30" aria-pressed="false">30 days</button><button type="button" data-days="14" aria-pressed="false">14 days</button><button type="button" data-days="7" aria-pressed="false">7 days</button></div>
      <label class="check"><input type="checkbox" id="labs"> Only papers with an open abstract</label>
    </div>
    <p class="count" id="lcount"></p>
    <div id="lout"></div>
    <div class="more-row"><button class="btn" type="button" id="lmore" hidden>Show more papers</button></div>
    <details class="note"><summary>Which journals are included</summary><p>${data.journals.map(esc).join(", ")}.</p><p>${esc(data.rule)}</p></details>
  </section></div>`;

  const $ = (id) => document.getElementById(id);
  const fillTasks = () => {
    const f = st.field ? [fieldOf(st.field)] : S.fields;
    const options = f.flatMap((x) => (x.tasks || []).map((t) => [`${x.id}:${t.id}`, st.field ? t.label : `${x.label}: ${t.label}`]))
      .filter(([id]) => all.some((p) => p.tasks.includes(id)));
    $("ltask").innerHTML = `<option value="">All tasks</option>` + options.map(([id, l]) => `<option value="${esc(id)}">${esc(l)}</option>`).join("");
  };
  const filtered = () => {
    const q = $("lq").value.trim().toLowerCase(), task = $("ltask").value, jour = $("ljour").value;
    const cut = st.days ? Date.now() - st.days * 864e5 : 0;
    const out = all.filter((p) =>
      (!st.field || p.fields?.includes(st.field)) && (!task || p.tasks.includes(task)) && (!jour || p.journal === jour) &&
      (!cut || Date.parse(p.date) >= cut) && (!$("labs").checked || p.abstract) &&
      (!q || p.title.toLowerCase().includes(q) || p.authors.toLowerCase().includes(q) || p.method.toLowerCase().includes(q) || p.keywords.some((k) => k.toLowerCase().includes(q))));
    if ($("lsort").value === "cited") out.sort((a, b) => b.cited - a.cited);
    else out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return out;
  };
  const draw = (reset = true) => {
    if (reset) st.shown = 30;
    const list = filtered();
    $("lcount").textContent = `${num(list.length)} of ${num(all.length)} papers`;
    const page = list.slice(0, st.shown);
    let html = "", day = "";
    for (const p of page) {
      if ($("lsort").value === "date" && p.date !== day) {
        day = p.date;
        html += `<h3 class="day">${esc(prettyDate(day))}</h3>`;
      }
      html += paperCard(p, "");
    }
    $("lout").innerHTML = page.length ? `<div class="paper-list">${html}</div>` : `<p class="note">No paper matches these filters.</p>`;
    $("lmore").hidden = list.length <= st.shown;
  };
  $("lfields").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-field]");
    if (!b) return;
    st.field = b.dataset.field;
    replaceHash(st.field ? `#latest/${st.field}` : "#latest");
    $("lfields").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    fillTasks();
    draw();
  });
  $("ldays").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    st.days = Number(b.dataset.days);
    $("ldays").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  ["lq", "ltask", "ljour", "lsort", "labs"].forEach((id) => $(id).addEventListener("input", () => draw()));
  $("lmore").addEventListener("click", () => { st.shown += 30; draw(false); });
  if (preset) $("lq").value = preset;
  fillTasks();
  draw();
}

async function pagePapers(fieldId) {
  view.innerHTML = `<div class="page"><p class="loading">Loading papers…</p></div>`;
  const papers = await need("papers");
  if (!papers?.fields?.length) return (view.innerHTML = `<div class="page"><p class="note">Papers have not been fetched yet. The daily job fills this page.</p></div>`);
  const current = papers.fields.find((x) => x.id === fieldId) || papers.fields[0];
  const f = fieldOf(current.id);
  const list = current.papers;
  const taskCount = {}, dsCount = {};
  list.forEach((p) => { p.tasks.forEach((t) => (taskCount[t] = (taskCount[t] || 0) + 1)); p.datasets.forEach((d) => (dsCount[d] = (dsCount[d] || 0) + 1)); });
  const years = [...new Set(list.map((p) => p.year).filter(Boolean))].sort();
  const journals = [...new Set(list.map((p) => p.journal).filter(Boolean))].sort();

  view.innerHTML = `<div class="page"><section class="section">
    <h1>Papers</h1>
    ${paperTabs("top")}
    <p class="lede">Open-access papers ranked by citations, refreshed daily from Europe PMC. Filter by task, dataset, year and venue, then switch to the comparison table to set methods side by side.</p>
    ${gel({ id: "pfields", active: current.id, counts: Object.fromEntries(papers.fields.map((x) => [x.id, x.papers.length])), unit: "papers", link: (id) => `#papers/${id}` })}
    <div class="chips" id="tasks"><button class="chip plain" type="button" data-task="" aria-pressed="true">All tasks</button>${(f.tasks || [])
      .filter((t) => taskCount[t.id])
      .map((t) => `<button class="chip" type="button" style="--dot:${baseVar(f)}" data-task="${esc(t.id)}" aria-pressed="false">${esc(t.label)} <span class="n">${taskCount[t.id]}</span></button>`)
      .join("")}</div>
    <div class="controls">
      <div class="control"><label for="pq">Search</label><input class="input" id="pq" type="search" placeholder="Title, method, keyword"></div>
      <div class="control"><label for="pds">Dataset or database</label><select class="input" id="pds"><option value="">Any</option>${Object.entries(dsCount)
        .sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${esc(k)}">${esc(dsName(k))} (${n})</option>`).join("")}</select></div>
      <div class="control"><label for="pfrom">From year</label><select class="input" id="pfrom"><option value="">Any</option>${years.map((y) => `<option>${y}</option>`).join("")}</select></div>
      <div class="control"><label for="pjour">Venue</label><select class="input" id="pjour"><option value="">Any</option>${journals.map((j) => `<option>${esc(j)}</option>`).join("")}</select></div>
      <div class="control"><label for="pcit">Min. citations</label><input class="input" id="pcit" type="number" min="0" step="10" placeholder="0"></div>
      <div class="control"><label for="psort">Sort by</label><select class="input" id="psort"><option value="cited">Most cited</option><option value="year">Newest</option><option value="title">Title</option></select></div>
    </div>
    <div class="toolbar">
      <div class="seg" id="plist"><button type="button" data-list="" aria-pressed="true">All</button><button type="button" data-list="classic" aria-pressed="false">Most cited ever</button><button type="button" data-list="recent" aria-pressed="false">Last 24 months</button></div>
      <div class="seg" id="pview"><button type="button" data-view="list" aria-pressed="true">Abstracts</button><button type="button" data-view="table" aria-pressed="false">Compare methods</button></div>
    </div>
    <p class="count" id="pcount"></p>
    <div id="pout"></div>
    <p class="note">Tasks are assigned from keyword patterns and datasets are the databases and datasets named in each title, abstract or keyword list, so check the paper before relying on a tag. Query: <span class="mono">${esc(current.query)}</span>. Fetched ${esc(papers.generated_at)}.</p>
  </section></div>`;

  const st = { task: "", list: "", view: "list", sort: "cited", dir: -1 };
  const $ = (id) => document.getElementById(id);
  const draw = () => {
    const q = $("pq").value.trim().toLowerCase();
    const ds = $("pds").value, from = $("pfrom").value, jour = $("pjour").value, min = Number($("pcit").value || 0);
    let out = list.filter((p) =>
      (!st.task || p.tasks.includes(st.task)) && (!st.list || p.lists.includes(st.list)) && (!ds || p.datasets.includes(ds)) &&
      (!from || p.year >= from) && (!jour || p.journal === jour) && p.cited >= min &&
      (!q || p.title.toLowerCase().includes(q) || p.method.toLowerCase().includes(q) || p.keywords.some((k) => k.toLowerCase().includes(q))));
    const key = $("psort").value;
    out.sort((a, b) => key === "year" ? (b.date || b.year).localeCompare(a.date || a.year) : key === "title" ? a.title.localeCompare(b.title) : b.cited - a.cited);
    $("pcount").textContent = `${out.length} of ${list.length} papers`;
    if (!out.length) { $("pout").innerHTML = `<p class="note">No paper matches these filters.</p>`; return; }
    $("pout").innerHTML = st.view === "list"
      ? `<div class="paper-list">${out.map((p) => paperCard(p, current.id)).join("")}</div>`
      : `<div class="table-wrap"><table class="compare"><thead><tr><th>Method</th><th>Paper</th><th>Year</th><th>Venue</th><th>Cited</th><th>Tasks</th><th>Datasets named</th><th>Text</th></tr></thead><tbody>${out
          .map((p) => `<tr><td><b>${esc(p.method || "—")}</b></td><td><a href="${esc(safe(p.url))}" target="_blank" rel="noopener">${esc(p.title)}</a></td>
            <td class="num">${esc(p.year)}</td><td>${esc(p.journal)}</td><td class="num">${num(p.cited)}</td>
            <td><div class="tags">${p.tasks.map((t) => `<span class="tag task">${esc(taskLabel(current.id, t))}</span>`).join("")}</div></td>
            <td><div class="tags">${uniqueByName(p.datasets).map((d) => `<a class="tag ds" href="${esc(dsHref(d))}">${esc(dsName(d))}</a>`).join("") || `<span class="muted">—</span>`}</div></td>
            <td class="nowrap">${safe(p.pdf) ? `<a href="${esc(p.pdf)}" target="_blank" rel="noopener">PDF</a>` : "—"}</td></tr>`)
          .join("")}</tbody></table></div>`;
  };
  $("tasks").addEventListener("click", (e) => {
    const b = e.target.closest("[data-task]"); if (!b) return;
    st.task = b.dataset.task;
    $("tasks").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    draw();
  });
  for (const [id, key] of [["plist", "list"], ["pview", "view"]]) {
    $(id).addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      st[key] = b.dataset[key];
      $(id).querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    });
  }
  ["pq", "pds", "pfrom", "pjour", "pcit", "psort"].forEach((id) => $(id).addEventListener("input", draw));
  draw();
}

// "Sun, N., Zou, S. … (2024). Title" -> "Sun et al., 2024"
function shortCite(text) {
  const year = (text.match(/\((\d{4})\)/) || text.match(/\b(19|20)\d{2}\b/) || [""])[0].replace(/[()]/g, "");
  const first = text.trim().split(/[,.]/)[0].trim().split(/\s+/);
  const surname = /^[A-Z]\.?$/.test(first[0] || "") ? first[first.length - 1] : first.length > 1 && !/,/.test(text.split(" ")[0]) ? first[first.length - 1] : first[0];
  return surname ? `${surname} et al.${year ? ", " + year : ""}` : "paper";
}

function boardTable(b, rows, full = true) {
  const max = Math.max(...b.rows.map((r) => r.score));
  return `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Model</th><th>Family</th><th>${esc(b.metric_label)}</th>${full ? b.columns.map((c) => `<th>${esc(c)}</th>`).join("") + "<th>Paper</th>" : ""}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td class="num">${r.rank}</td><td>${benchIdx?.modelKey.has(r.model) ? `<a href="${modelHref(r.model)}"><b>${esc(r.model)}</b></a>` : `<b>${esc(r.model)}</b>`}</td><td class="muted">${esc(r.kind)}</td>
      <td class="num"><span class="bar"><i style="width:${Math.max(2, (r.score / max) * 90).toFixed(0)}px"></i>${r.score.toFixed(3)}</span></td>
      ${full ? r.values.map((v) => `<td class="num">${v == null ? "—" : v.toFixed(3)}</td>`).join("") +
        `<td class="nowrap">${safe(r.paper_url) ? `<a href="${esc(r.paper_url)}" target="_blank" rel="noopener" title="${esc(r.paper)}">${esc(shortCite(r.paper))}</a>` : "—"}</td>` : ""}</tr>`).join("")}</tbody>
  </table></div>`;
}

// ---------- benchmarks ----------
// Two kinds of results tables: boards that benchmark maintainers publish
// (leaderboards.json, fetched daily) and tables from the Papers with Code
// archive (data/benchmarks/*.json). Approved ranking changes from
// data/rankings.toml (rankings.json) are applied on top of the archive tables.
async function needTables() {
  if (S.tables) return S.tables;
  const files = await Promise.all(S.fields.map((f) => load(`benchmarks/pwc-${f.id}`).catch(() => null)));
  const rk = await load("rankings").catch(() => ({}));
  const approved = new Map((rk?.table || []).map((t) => [t.id, t]));
  S.tables = files.filter(Boolean).flatMap((f) => f.tables.map((t) => ({ ...t, source_name: f.source, source_url: f.url, license: f.license, snapshot: f.snapshot, approved: approved.get(t.id) || null })));
  searchIndex = null;
  return S.tables;
}
const numOf = (v) => {
  if (v == null) return null;
  const x = parseFloat(String(v).replace(/[%,\s]/g, "").replace(/±.*$/, ""));
  return Number.isFinite(x) ? x : null;
};
function approvedView(t) {
  const a = t.approved || {};
  const metric = a.metric && t.metrics.some((m) => m.name === a.metric) ? a.metric : t.metric;
  const higher = typeof a.higher === "boolean" ? a.higher : t.metrics.find((m) => m.name === metric)?.higher ?? true;
  return { metric, higher, exclude: new Set(a.exclude || []) };
}
// Rank the rows of a table under a view { metric, higher, exclude }; equal scores share a rank.
function rankRows(t, v) {
  const added = (t.approved?.add || []).map((a) => ({ ...a, values: Object.fromEntries(Object.entries(a.values || {}).map(([k, x]) => [k, String(x)])), added: true }));
  const scored = [...t.rows, ...added].map((r) => ({ r, s: numOf(r.values[v.metric]), out: v.exclude.has(r.model) }));
  scored.sort((a, b) => a.out - b.out || (a.s == null) - (b.s == null) || (v.higher ? b.s - a.s : a.s - b.s) || a.r.model.localeCompare(b.r.model));
  let rank = 0, prev = null, n = 0;
  return scored.map((x) => {
    if (x.out || x.s == null) return { ...x, rank: null };
    n++;
    if (x.s !== prev) { rank = n; prev = x.s; }
    return { ...x, rank };
  });
}
// The repository that takes proposals: a <meta name="atlas-repo"> override,
// otherwise derived from the GitHub Pages address.
function repoUrl() {
  const meta = document.querySelector('meta[name="atlas-repo"]')?.content?.trim();
  if (meta) return meta.replace(/\/$/, "");
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  if (!m) return "";
  const first = location.pathname.split("/").filter(Boolean)[0];
  return `https://github.com/${m[1]}/${first || `${m[1]}.github.io`}`;
}
function proposalToml(t, v, note) {
  const q = JSON.stringify;
  const lines = ["[[table]]", `id = ${q(t.id)}`, `metric = ${q(v.metric)}`, `higher = ${v.higher}`];
  if (v.exclude.size) lines.push(`exclude = [${[...v.exclude].map(q).join(", ")}]`);
  if (note.trim()) lines.push(`note = ${q(note.trim())}`);
  lines.push("", "# To add a published result, remove the # signs and fill in:", "# [[table.add]]", '# model = "Model name"', '# paper = "Paper title"',
    '# url = "https://doi.org/..."', `# values = { ${q(v.metric)} = 0.0 }`);
  return lines.join("\n");
}

// Every result of every table and board, indexed by model, paper and dataset.
// Each result carries its rank under the approved ranking and its rank on
// every numeric metric of its table.
let benchIdx = null;
const benchKey = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "item";
function keyed(names) {
  const out = new Map(), used = new Set();
  for (const n of [...names].sort()) {
    let k = benchKey(n), i = 2;
    while (used.has(k)) k = `${benchKey(n)}-${i++}`;
    used.add(k);
    out.set(n, k);
  }
  return out;
}
const paperName = (s) => (s || "").replace(/\s+/g, " ").trim();
function metricRanks(rows, metric, higher, exclude) {
  const vals = rows.filter((r) => !exclude.has(r.model)).map((r) => ({ r, s: numOf(r.values[metric]) })).filter((x) => x.s != null);
  vals.sort((a, b) => (higher ? b.s - a.s : a.s - b.s));
  const ranks = new Map();
  let rank = 0, prev = null;
  vals.forEach((x, i) => { if (x.s !== prev) { rank = i + 1; prev = x.s; } ranks.set(x.r, rank); });
  return { ranks, of: vals.length };
}
function buildBenchIndex(tables, boards) {
  if (benchIdx) return benchIdx;
  const entries = [];
  for (const t of tables) {
    const v = approvedView(t);
    const ranked = rankRows(t, v);
    const rows = ranked.map((x) => x.r);
    const total = ranked.filter((x) => x.rank != null).length;
    const per = t.metrics.filter((m) => m.parsed >= 2).map((m) => {
      const higher = m.name === v.metric ? v.higher : m.higher;
      return { name: m.name, higher, ...metricRanks(rows, m.name, higher, v.exclude) };
    });
    for (const x of ranked) {
      entries.push({ kind: "table", id: t.id, task: t.task, dataset: t.dataset, field: t.field, metric: v.metric, higher: v.higher,
        model: x.r.model, paper: paperName(x.r.paper), url: x.r.url, code: x.r.code, date: x.r.date, rank: x.rank, total, out: x.out, extra: x.r.extra, added: x.r.added,
        metrics: per.filter((m) => x.r.values[m.name] != null).map((m) => ({ name: m.name, value: x.r.values[m.name], rank: m.ranks.get(x.r) ?? null, of: m.of, higher: m.higher })) });
    }
  }
  for (const b of boards) {
    for (const r of b.rows) {
      entries.push({ kind: "board", id: b.id, task: b.title.replace(/^[^:]+:\s*/, ""), dataset: b.title.split(":")[0], field: b.field, metric: b.metric_label, higher: b.higher,
        model: r.model, paper: paperName(r.paper), url: r.paper_url, code: "", date: "", rank: r.rank, total: b.rows.length, out: false,
        metrics: [{ name: b.metric_label, value: r.score.toFixed(3), rank: r.rank, of: b.rows.length, higher: b.higher }] });
    }
  }
  const group = (key) => {
    const m = new Map();
    for (const e of entries) { const k = key(e); if (k) (m.get(k) || m.set(k, []).get(k)).push(e); }
    return m;
  };
  const byModel = group((e) => e.model), byPaper = group((e) => e.paper), byDataset = group((e) => e.dataset);
  benchIdx = { entries, byModel, byPaper, byDataset, modelKey: keyed(byModel.keys()), paperKey: keyed(byPaper.keys()), datasetKey: keyed(byDataset.keys()) };
  for (const n of ["model", "paper", "dataset"]) benchIdx[`${n}ByKey`] = new Map([...benchIdx[`${n}Key`]].map(([name, k]) => [k, name]));
  searchIndex = null;
  return benchIdx;
}
const modelHref = (n) => `#benchmarks/model/${benchIdx.modelKey.get(n)}`;
const paperHref = (n) => `#benchmarks/paper/${benchIdx.paperKey.get(n)}`;
const datasetHref = (n) => `#benchmarks/dataset/${benchIdx.datasetKey.get(n)}`;
const entryHref = (e) => `#benchmarks/${e.id}`;
const placeText = (e) => (e.out ? "left out" : e.rank == null ? "no score" : `${e.rank} of ${e.total}`);
function summarize(list) {
  const ranks = list.filter((e) => e.rank != null).map((e) => e.rank);
  return {
    tables: new Set(list.map((e) => e.id)).size,
    first: new Set(list.filter((e) => e.rank === 1).map((e) => e.id)).size,
    best: ranks.length ? Math.min(...ranks) : null,
    fields: [...new Set(list.map((e) => e.field))],
    year: list.map((e) => (e.date || "").slice(0, 4)).filter(Boolean).sort()[0] || "",
  };
}
const benchTabs = (on, idx, nTables) => `<nav class="tabbar" aria-label="Benchmark views">
  <a href="#benchmarks" ${on === "tables" ? 'aria-current="page"' : ""}>Tables <small>${nTables} results tables</small></a>
  <a href="#benchmarks/models" ${on === "models" ? 'aria-current="page"' : ""}>Models <small>${num(idx.byModel.size)} models</small></a>
  <a href="#benchmarks/papers" ${on === "papers" ? 'aria-current="page"' : ""}>Papers <small>${num(idx.byPaper.size)} papers</small></a>
</nav>`;

async function pageBenchmarks(a, b) {
  view.innerHTML = `<div class="page"><p class="loading">Loading benchmarks…</p></div>`;
  const [data, tables] = await Promise.all([need("boards"), needTables()]);
  const boards = data?.boards || [];
  const idx = buildBenchIndex(tables, boards);
  if (a === "models" || a === "papers") return pageBenchList(a, tables, b || "");
  if (a === "model" && idx.modelByKey.has(b)) return pageBenchProfile("model", idx.modelByKey.get(b));
  if (a === "paper" && idx.paperByKey.has(b)) return pageBenchProfile("paper", idx.paperByKey.get(b));
  if (a === "dataset" && idx.datasetByKey.has(b)) return pageBenchIndex(boards, tables, "", "", idx.datasetByKey.get(b));
  if (a && boards.some((x) => x.id === a)) return pageBoard(boards, a);
  const t = tables.find((x) => x.id === a);
  if (t) return pageTable(t);
  return pageBenchIndex(boards, tables, S.fields.some((f) => f.id === a) ? a : "", b || "", "");
}

function pageBenchIndex(boards, tables, field, preset, dataset) {
  const counts = {};
  tables.forEach((t) => (counts[t.field] = (counts[t.field] || 0) + 1));
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Benchmarks</h1>
    <p class="lede">Published results, ranked. Open a table to rank it by another metric, or a model or paper to see every ranking it appears in. Anyone can propose a different ranking, and it goes live once a maintainer approves it.</p>
    ${benchTabs("tables", benchIdx, tables.length)}
    ${boards.length ? `<div class="section-head"><h2>Maintained boards</h2><span class="hint">Copied daily from the benchmark maintainers</span></div>
    <ul class="board-list">${boards.map((x) => `<li><a href="#benchmarks/${esc(x.id)}"><b>${esc(x.title)}</b><span class="hint">${x.rows.length} models, ranked by ${esc(x.metric_label)}</span></a></li>`).join("")}</ul>` : ""}
    <div class="section-head"><h2>Results tables</h2><span class="hint">${tables.length} tables from the Papers with Code archive</span></div>
    ${gel({ id: "bgel", active: field, counts, unit: "tables", search: { id: "bq", placeholder: "Filter by task, dataset, metric or model", value: preset } })}
    <div class="controls bench-filters">
      <div class="control"><label for="btask">Task</label><select class="input" id="btask"></select></div>
      <div class="control"><label for="bds">Dataset</label><select class="input" id="bds"></select></div>
    </div>
    <p class="count" id="bcount"></p>
    <div class="table-wrap"><table class="bench-index">
      <thead><tr><th>Task</th><th>Dataset</th><th>Ranked by</th><th>Models</th><th>Leader</th></tr></thead>
      <tbody id="brows"></tbody>
    </table></div>
    <div class="more-row"><button class="btn" type="button" id="bmore" hidden>Show more tables</button></div>
  </section></div>`;
  let active = field, task = "", ds = dataset, shown = 40;
  const q = document.getElementById("bq");
  const options = (el, label, values, current) => {
    const c = {};
    values.forEach((x) => (c[x] = (c[x] || 0) + 1));
    el.innerHTML = `<option value="">${label}</option>` + Object.keys(c).sort((x, y) => x.localeCompare(y))
      .map((x) => `<option value="${esc(x)}" ${x === current ? "selected" : ""}>${esc(x)} (${c[x]})</option>`).join("");
  };
  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const inField = tables.filter((t) => !active || t.field === active);
    if (task && !inField.some((t) => t.task === task)) task = "";
    if (ds && !inField.some((t) => t.dataset === ds && (!task || t.task === task))) ds = "";
    options(document.getElementById("btask"), "All tasks", inField.filter((t) => !ds || t.dataset === ds).map((t) => t.task), task);
    options(document.getElementById("bds"), "All datasets", inField.filter((t) => !task || t.task === task).map((t) => t.dataset), ds);
    const list = inField.filter((t) => (!task || t.task === task) && (!ds || t.dataset === ds) && (!term ||
      `${t.task} ${t.dataset} ${t.path.join(" ")} ${t.metrics.map((m) => m.name).join(" ")} ${t.rows.map((r) => r.model).join(" ")}`.toLowerCase().includes(term)));
    document.getElementById("bcount").textContent = `${list.length} of ${tables.length} tables`;
    document.getElementById("brows").innerHTML = list.slice(0, shown).map((t) => {
      const v = approvedView(t);
      const top = rankRows(t, v).filter((x) => x.rank === 1);
      return `<tr><td><a href="#benchmarks/${esc(t.id)}"><b>${esc(t.task)}</b></a></td>
        <td><a href="${datasetHref(t.dataset)}">${esc(t.dataset)}</a></td>
        <td>${esc(v.metric)} <span class="hint">${v.higher ? "higher is better" : "lower is better"}</span></td><td class="num">${t.rows.length}</td>
        <td>${top.length ? top.map((x) => `<a href="${modelHref(x.r.model)}">${esc(x.r.model)}</a> <span class="mono hint">${esc(x.r.values[v.metric])}</span>`).join("<br>") : "—"}</td></tr>`;
    }).join("") || `<tr><td colspan="5" class="note">No table matches this filter.</td></tr>`;
    document.getElementById("bmore").hidden = list.length <= shown;
  };
  q.addEventListener("input", () => { shown = 40; draw(); });
  document.getElementById("btask").addEventListener("change", (e) => { task = e.target.value; shown = 40; draw(); });
  document.getElementById("bds").addEventListener("change", (e) => {
    ds = e.target.value;
    replaceHash(ds ? datasetHref(ds) : active ? `#benchmarks/${active}` : "#benchmarks");
    shown = 40;
    draw();
  });
  document.getElementById("bmore").addEventListener("click", () => { shown += 40; draw(); });
  document.getElementById("bgel").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-field]");
    if (!btn) return;
    active = btn.dataset.field;
    replaceHash(active ? `#benchmarks/${active}` : "#benchmarks");
    document.querySelectorAll("#bgel button").forEach((x) => x.setAttribute("aria-pressed", String(x === btn)));
    shown = 40;
    draw();
  });
  draw();
}

// Models or papers, with how many tables they appear in and how many they lead.
function pageBenchList(kind, tables, preset) {
  const idx = benchIdx;
  const groups = kind === "models" ? idx.byModel : idx.byPaper;
  const items = [...groups].map(([name, list]) => ({ name, list, ...summarize(list), models: new Set(list.map((e) => e.model)).size }));
  const counts = {};
  items.forEach((it) => it.fields.forEach((f) => (counts[f] = (counts[f] || 0) + 1)));
  const label = kind === "models" ? "models" : "papers";
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Benchmarks</h1>
    <p class="lede">${kind === "models" ? "Every model in the results tables. Open one to see each ranking it appears in and its result on every metric." : "Every paper behind a published result. Open one to see the rankings its models reach on every metric."}</p>
    ${benchTabs(kind, idx, tables.length)}
    ${gel({ id: "lgel", active: "", counts, unit: label, search: { id: "lq", placeholder: kind === "models" ? "Filter models" : "Filter papers by title or model", value: preset } })}
    <div class="controls bench-filters">
      <div class="control"><label for="lsort">Sort</label><select class="input" id="lsort">
        <option value="first">Most first places</option><option value="tables">Most tables</option><option value="name">Name</option>${kind === "papers" ? '<option value="year">Newest</option>' : ""}
      </select></div>
    </div>
    <p class="count" id="lcount"></p>
    <div class="table-wrap"><table class="bench-index">
      <thead><tr><th>${kind === "models" ? "Model" : "Paper"}</th>${kind === "papers" ? "<th>Year</th><th>Models</th>" : "<th>Papers</th>"}<th>Tables</th><th>First places</th><th>Best rank</th><th>Fields</th></tr></thead>
      <tbody id="lrows"></tbody>
    </table></div>
    <div class="more-row"><button class="btn" type="button" id="lmore" hidden>Show more ${label}</button></div>
  </section></div>`;
  let active = "", shown = 50;
  const q = document.getElementById("lq");
  const href = kind === "models" ? modelHref : paperHref;
  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const sort = document.getElementById("lsort").value;
    const list = items.filter((it) => (!active || it.fields.includes(active)) &&
      (!term || `${it.name} ${it.list.map((e) => `${e.model} ${e.paper}`).join(" ")}`.toLowerCase().includes(term)));
    // when searching, the exact name first, then names that start with the term
    const fit = (it) => (!term ? 0 : it.name.toLowerCase() === term ? 0 : it.name.toLowerCase().startsWith(term) ? 1 : it.name.toLowerCase().includes(term) ? 2 : 3);
    list.sort((x, y) => fit(x) - fit(y) || (sort === "name" ? x.name.localeCompare(y.name) : sort === "tables" ? y.tables - x.tables || y.first - x.first
      : sort === "year" ? (y.year || "0").localeCompare(x.year || "0") || y.first - x.first : y.first - x.first || y.tables - x.tables || x.name.localeCompare(y.name)));
    document.getElementById("lcount").textContent = `${list.length} of ${items.length} ${label}`;
    document.getElementById("lrows").innerHTML = list.slice(0, shown).map((it) => `<tr>
      <td><a href="${href(it.name)}"><b>${esc(it.name.length > 120 ? it.name.slice(0, 120) + "…" : it.name)}</b></a></td>
      ${kind === "papers" ? `<td class="num">${esc(it.year || "—")}</td><td class="num">${it.models}</td>` : `<td class="num">${new Set(it.list.map((e) => e.paper).filter(Boolean)).size}</td>`}
      <td class="num">${it.tables}</td><td class="num">${it.first || "—"}</td><td class="num">${it.best ?? "—"}</td>
      <td>${it.fields.map((f) => `<span class="tag field" style="--dot:${baseVar(fieldOf(f))}">${esc(fieldOf(f).label)}</span>`).join(" ")}</td></tr>`).join("")
      || `<tr><td colspan="7" class="note">Nothing matches this filter.</td></tr>`;
    document.getElementById("lmore").hidden = list.length <= shown;
  };
  q.addEventListener("input", () => { shown = 50; draw(); });
  document.getElementById("lsort").addEventListener("change", () => { shown = 50; draw(); });
  document.getElementById("lmore").addEventListener("click", () => { shown += 50; draw(); });
  document.getElementById("lgel").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-field]");
    if (!btn) return;
    active = btn.dataset.field;
    document.querySelectorAll("#lgel button").forEach((x) => x.setAttribute("aria-pressed", String(x === btn)));
    shown = 50;
    draw();
  });
  draw();
}

// One model or one paper: every ranking it appears in, and its result and
// rank on every metric of each table.
function pageBenchProfile(kind, name) {
  const idx = benchIdx;
  const list = [...(kind === "model" ? idx.byModel : idx.byPaper).get(name)]
    .sort((x, y) => (x.rank ?? 1e9) / (x.total || 1) - (y.rank ?? 1e9) / (y.total || 1) || x.task.localeCompare(y.task));
  const s = summarize(list);
  const papers = [...new Map(list.filter((e) => e.paper).map((e) => [e.paper, e])).values()];
  const models = [...new Set(list.map((e) => e.model))];
  const links = list.find((e) => safe(e.url));
  const codes = [...new Set(list.map((e) => e.code).filter((c) => safe(c)))];
  const metricCell = (e) => `<ul class="metric-list">${e.metrics.map((m) => `<li${m.name === e.metric ? ' class="main"' : ""}>
      <span>${esc(m.name)}</span> <b class="mono">${esc(m.value)}</b>
      <span class="hint">${m.rank != null ? `${m.rank} of ${m.of}` : "not ranked"}${m.rank === 1 ? " (best)" : ""}</span></li>`).join("")}</ul>`;
  view.innerHTML = `<div class="page"><section class="section">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#benchmarks">Benchmarks</a><span aria-hidden="true">/</span><a href="#benchmarks/${kind}s">${kind === "model" ? "Models" : "Papers"}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(name.length > 60 ? name.slice(0, 60) + "…" : name)}</span></nav>
    <h1 class="${kind === "paper" ? "paper-title" : ""}">${esc(name)}</h1>
    <p class="lede">In ${s.tables} ${s.tables === 1 ? "ranking" : "rankings"}${s.first ? `, first in ${s.first}` : ""}${s.best && s.best > 1 ? `, best place ${s.best}` : ""}.</p>
    <div class="profile-facts">
      ${kind === "model"
        ? `<div><b>Reported in</b>${papers.map((e) => `<a href="${paperHref(e.paper)}">${esc(e.paper)}</a>`).join("") || '<span class="muted">No paper listed</span>'}</div>`
        : `<div><b>Models</b>${models.map((m) => `<a href="${modelHref(m)}">${esc(m)}</a>`).join("")}</div>
           <div><b>Paper</b>${links ? `<a href="${esc(links.url)}" target="_blank" rel="noopener">Read the paper</a>` : '<span class="muted">No link</span>'}${s.year ? `<span class="hint">Published ${esc(s.year)}</span>` : ""}</div>`}
      ${codes.length ? `<div><b>Code</b>${codes.map((c) => `<a href="${esc(c)}" target="_blank" rel="noopener">${esc(c.replace(/^https?:\/\/(www\.)?/, ""))}</a>`).join("")}</div>` : ""}
      <div><b>Fields</b>${s.fields.map((f) => `<a href="#benchmarks/${esc(f)}">${esc(fieldOf(f).label)}</a>`).join("")}</div>
    </div>
    <div class="controls bench-filters"><div class="control"><label for="pq">Filter</label><input class="input" id="pq" type="search" placeholder="Task, dataset or metric"></div></div>
    <p class="count" id="pcount"></p>
    <div class="table-wrap"><table class="bench-index profile">
      <thead><tr><th>Ranking</th><th>Dataset</th>${kind === "paper" ? "<th>Model</th>" : "<th>Paper</th>"}<th>Place</th><th>Result on every metric</th></tr></thead>
      <tbody id="prows"></tbody>
    </table></div>
    <p class="note">Place is the rank under the approved ranking of each table. Each metric shows the value as published and its rank among the results that report that metric.</p>
  </section></div>`;
  const draw = () => {
    const term = document.getElementById("pq").value.trim().toLowerCase();
    const rows = list.filter((e) => !term || `${e.task} ${e.dataset} ${e.metrics.map((m) => m.name).join(" ")}`.toLowerCase().includes(term));
    document.getElementById("pcount").textContent = `${rows.length} of ${list.length} results`;
    document.getElementById("prows").innerHTML = rows.map((e) => `<tr class="${e.out ? "out" : ""}">
      <td><a href="${entryHref(e)}"><b>${esc(e.task)}</b></a><br><span class="hint">ranked by ${esc(e.metric)}</span></td>
      <td>${e.kind === "table" ? `<a href="${datasetHref(e.dataset)}">${esc(e.dataset)}</a>` : esc(e.dataset)}</td>
      <td>${kind === "paper" ? `<a href="${modelHref(e.model)}">${esc(e.model)}</a>` : e.paper ? `<a href="${paperHref(e.paper)}">${esc(e.paper.length > 70 ? e.paper.slice(0, 70) + "…" : e.paper)}</a>` : "—"}${e.extra ? ' <span class="tag">extra data</span>' : ""}</td>
      <td class="num nowrap">${e.rank === 1 ? `<span class="tag leader">1st</span> of ${e.total}` : esc(placeText(e))}</td>
      <td>${metricCell(e)}</td></tr>`).join("") || `<tr><td colspan="5" class="note">Nothing matches this filter.</td></tr>`;
  };
  document.getElementById("pq").addEventListener("input", draw);
  draw();
}

function pageTable(t) {
  const f = fieldOf(t.field);
  const base = approvedView(t);
  const v = { metric: base.metric, higher: base.higher, exclude: new Set(base.exclude) };
  const ds = t.dataset_id ? S.datasets.find((d) => d.id === t.dataset_id) : null;
  const shownMetrics = () => t.metrics.map((m) => m.name).filter((m) => m !== v.metric).slice(0, 6);
  view.innerHTML = `<div class="page"><section class="section">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#benchmarks">Benchmarks</a><span aria-hidden="true">/</span><a href="#benchmarks/${esc(t.field)}">${esc(f.label)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(t.task)}</span></nav>
    <h1>${esc(t.task)}</h1>
    <p class="lede">On <a href="${datasetHref(t.dataset)}">${esc(t.dataset)}</a>. ${t.rows.length} published results.${ds ? ` About the data and how to download it: <a href="#datasets/${esc(ds.field)}/${encodeURIComponent(ds.name)}">${esc(ds.name)}</a>.` : ""}</p>
    ${t.path.length > 1 ? `<p class="hint">${esc(t.path.join(" / "))}</p>` : ""}
    <div class="controls">
      <div class="control"><label for="tm">Rank by</label><select class="input" id="tm">${t.metrics.filter((m) => m.parsed >= 2 || m.name === v.metric).map((m) => `<option ${m.name === v.metric ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div>
      <div class="control"><label for="th">Order</label><select class="input" id="th"><option value="1">Higher is better</option><option value="0">Lower is better</option></select></div>
      <div class="control"><label for="tq">Model</label><input class="input" id="tq" type="search" placeholder="Filter models"></div>
      <div class="control"><label class="check"><input type="checkbox" id="tedit"> Choose rows to leave out</label></div>
    </div>
    <div class="bench-status" id="tstatus" aria-live="polite"></div>
    <div id="tout"></div>
    <div class="proposal" id="tprop" hidden>
      <h2>Propose this ranking</h2>
      <p>Your proposal goes to the maintainers as a GitHub issue. Nothing changes on the site until they approve it.</p>
      <label for="tnote">Why this ranking is better</label>
      <textarea class="input" id="tnote" rows="3" placeholder="For example: the paper reports results on a different split."></textarea>
      <div class="code"><div class="code-bar"><span>Proposal</span><button class="btn small" type="button" data-copy-pre>Copy</button></div><pre id="ttoml"></pre></div>
      <div class="export-actions" id="tsend"></div>
    </div>
    <p class="note">Results as published in the papers, from the ${esc(t.source_name)} (snapshot ${esc(t.snapshot)}, ${esc(t.license)}). Rows marked “extra data” were trained with additional data.${t.approved?.note ? ` Approved note: ${esc(t.approved.note)}` : ""}</p>
  </section></div>`;
  document.getElementById("th").value = v.higher ? "1" : "0";
  const repo = repoUrl();
  const differs = () => v.metric !== base.metric || v.higher !== base.higher || v.exclude.size !== base.exclude.size || [...v.exclude].some((m) => !base.exclude.has(m));
  const draw = () => {
    const q = document.getElementById("tq").value.trim().toLowerCase();
    const edit = document.getElementById("tedit").checked;
    const ranked = rankRows(t, v).filter((x) => !q || x.r.model.toLowerCase().includes(q));
    const vals = ranked.map((x) => x.s).filter((s) => s != null);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const bar = (s) => (s == null || hi === lo ? 45 : 8 + 82 * (v.higher ? (s - lo) / (hi - lo) : (hi - s) / (hi - lo)));
    const others = shownMetrics();
    document.getElementById("tout").innerHTML = `<div class="table-wrap"><table class="bench">
      <thead><tr>${edit ? "<th>Leave out</th>" : ""}<th>#</th><th>Model</th><th>${esc(v.metric)}</th>${others.map((m) => `<th>${esc(m)}</th>`).join("")}<th>Paper</th><th>Code</th></tr></thead>
      <tbody>${ranked.map((x) => `<tr class="${x.out ? "out" : ""}">
        ${edit ? `<td><input type="checkbox" data-out="${esc(x.r.model)}" ${x.out ? "checked" : ""} aria-label="Leave out ${esc(x.r.model)}"></td>` : ""}
        <td class="num">${x.out ? "out" : x.rank ?? "—"}</td>
        <td><a href="${modelHref(x.r.model)}"><b>${esc(x.r.model)}</b></a>${x.r.extra ? ' <span class="tag">extra data</span>' : ""}${x.r.added ? ' <span class="tag">added</span>' : ""}</td>
        <td class="num">${x.s == null ? `<span class="muted">${esc(x.r.values[v.metric] || "—")}</span>` : `<span class="bar"><i style="width:${bar(x.s).toFixed(0)}px"></i>${esc(x.r.values[v.metric])}</span>`}</td>
        ${others.map((m) => `<td class="num">${esc(x.r.values[m] ?? "—")}</td>`).join("")}
        <td>${paperName(x.r.paper) ? `<a href="${paperHref(paperName(x.r.paper))}" title="${esc(x.r.paper)}">${esc(x.r.paper.slice(0, 60))}${x.r.paper.length > 60 ? "…" : ""}</a>` : "—"}${x.r.date ? ` <span class="hint">${esc(x.r.date.slice(0, 4))}</span>` : ""}</td>
        <td>${safe(x.r.code) ? `<a href="${esc(x.r.code)}" target="_blank" rel="noopener">Code</a>` : ""}</td></tr>`).join("")}</tbody>
    </table></div>`;
    const a = t.approved;
    document.getElementById("tstatus").innerHTML = differs()
      ? `<p><b>Your view differs from the approved ranking</b> (${esc(base.metric)}, ${base.higher ? "higher" : "lower"} is better${base.exclude.size ? `, ${base.exclude.size} left out` : ""}).</p>
         <div class="export-actions"><button class="btn solid" type="button" id="tpropose">Propose this ranking</button><button class="btn" type="button" id="treset">Back to the approved ranking</button></div>`
      : `<p>${a ? `Ranking approved in ${esc(a.approved || "a reviewed proposal")}.` : "Ranked by the table’s main metric, as published."} Change the metric, the order or the rows to propose a different ranking.</p>`;
    document.getElementById("tpropose")?.addEventListener("click", openProposal);
    document.getElementById("treset")?.addEventListener("click", () => {
      v.metric = base.metric; v.higher = base.higher; v.exclude = new Set(base.exclude);
      document.getElementById("tm").value = v.metric; document.getElementById("th").value = v.higher ? "1" : "0";
      document.getElementById("tprop").hidden = true;
      draw();
    });
    if (!document.getElementById("tprop").hidden) fillProposal();
  };
  const fillProposal = () => {
    const toml = proposalToml(t, v, document.getElementById("tnote").value);
    document.getElementById("ttoml").textContent = toml;
    const title = `Ranking: ${t.task} on ${t.dataset}`.slice(0, 120);
    const url = repo && `${repo}/issues/new?template=ranking-change.yml&labels=ranking&title=${encodeURIComponent(title)}&table=${encodeURIComponent(t.id)}&proposal=${encodeURIComponent(toml)}&reason=${encodeURIComponent(document.getElementById("tnote").value)}`;
    document.getElementById("tsend").innerHTML = url
      ? `<a class="btn solid" href="${esc(url)}" target="_blank" rel="noopener">Open the proposal on GitHub</a>`
      : `<p class="hint">This copy of the site is not linked to a GitHub repository. Copy the proposal and open an issue in the repository that publishes the atlas.</p>`;
  };
  const openProposal = () => {
    document.getElementById("tprop").hidden = false;
    fillProposal();
    document.getElementById("tprop").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  document.getElementById("tnote").addEventListener("input", fillProposal);
  document.getElementById("tm").addEventListener("change", (e) => {
    v.metric = e.target.value;
    v.higher = t.metrics.find((m) => m.name === v.metric)?.higher ?? true;
    document.getElementById("th").value = v.higher ? "1" : "0";
    draw();
  });
  document.getElementById("th").addEventListener("change", (e) => { v.higher = e.target.value === "1"; draw(); });
  document.getElementById("tq").addEventListener("input", draw);
  document.getElementById("tedit").addEventListener("change", draw);
  document.getElementById("tout").addEventListener("change", (e) => {
    const c = e.target.closest("[data-out]");
    if (!c) return;
    c.checked ? v.exclude.add(c.dataset.out) : v.exclude.delete(c.dataset.out);
    draw();
  });
  draw();
}

function pageBoard(boards, id) {
  const b = boards.find((x) => x.id === id);
  const kinds = [...new Set(b.rows.map((r) => r.kind).filter(Boolean))].sort();
  view.innerHTML = `<div class="page"><section class="section">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#benchmarks">Benchmarks</a><span aria-hidden="true">/</span><span aria-current="page">${esc(b.title)}</span></nav>
    <h1>${esc(b.title)}</h1>
    <p class="lede">Copied daily from the results table the benchmark maintainers publish, and shown exactly as published.</p>
    <div class="chips">${boards.map((x) => `<a class="chip" style="--dot:${baseVar(fieldOf(x.field))}" href="#benchmarks/${esc(x.id)}" aria-pressed="${x.id === b.id}">${esc(x.title.replace(/^[^:]+:\s*/, ""))}</a>`).join("")}</div>
    <div class="section-head"><h2>Ranking</h2><span class="hint">${b.rows.length} models, ${b.higher ? "higher is better" : "lower is better"}</span></div>
    <div class="controls">
      <div class="control"><label for="bq">Model</label><input class="input" id="bq" type="search" placeholder="Filter models"></div>
      <div class="control"><label for="bk">Family</label><select class="input" id="bk"><option value="">All families</option>${kinds.map((k) => `<option>${esc(k)}</option>`).join("")}</select></div>
    </div>
    <div id="bout"></div>
    <p class="note">Source: <a href="${esc(safe(b.source))}" target="_blank" rel="noopener">${esc(b.source)}</a> . CSV: <span class="mono">${esc(b.csv)}</span>. Fetched ${esc(b.fetched_at)}. Task: ${esc(taskLabel(b.field, b.task))}.</p>
  </section></div>`;
  const draw = () => {
    const q = document.getElementById("bq").value.trim().toLowerCase();
    const k = document.getElementById("bk").value;
    const rows = b.rows.filter((r) => (!k || r.kind === k) && (!q || r.model.toLowerCase().includes(q)));
    document.getElementById("bout").innerHTML = rows.length ? boardTable(b, rows) : `<p class="note">No model matches.</p>`;
  };
  ["bq", "bk"].forEach((x) => document.getElementById(x).addEventListener("input", draw));
  draw();
}

function pageStatus() {
  const checked = S.status?.checked_at;
  view.innerHTML = `<div class="page"><section class="section">
    <h1>Source status</h1>
    <p class="lede">Each day the build requests every source's website and the download link of its current release. A server that refuses automated checks still counts as up.</p>
    ${checked ? `<p class="hint">Last check: <span class="mono">${esc(checked)}</span></p>` : `<p class="note">No check has run yet. The first run of the daily job on GitHub fills this table.</p>`}
    <div class="table-wrap"><table>
      <thead><tr><th>Database</th><th>Website</th><th>HTTP</th><th>Response</th><th>Download link</th><th>Last 30 days</th></tr></thead>
      <tbody>${S.sources.map((s) => {
        const st = statusOf(s.id), l = S.status?.links?.[s.id];
        return `<tr><td><a href="#source/${esc(s.id)}">${esc(s.name)}</a></td>
          <td class="nowrap">${dot(s.id)} ${st ? esc(STATE_LABEL[st.state] || st.state) : `<span class="muted">—</span>`}</td>
          <td class="num">${st ? st.code || "—" : "—"}</td><td class="num">${st ? st.ms + " ms" : "—"}</td>
          <td class="nowrap">${l ? `<span class="dot ${esc(l.state)}"></span> ${l.code || "—"}` : `<span class="muted">—</span>`}</td><td>${history(s.id)}</td></tr>`;
      }).join("")}</tbody>
    </table></div>
  </section></div>`;
}

function pageAbout() {
  const b = S.build || {};
  const inputs = Object.entries(b.inputs || {}).map(([k, v]) => `${v.slice(0, 16)}…  ${k}`).join("\n");
  view.innerHTML = `<div class="page"><section class="section">
    <h1>How the atlas is built</h1>
    <div class="prose">
      <p>The site is a set of static pages. A small Rust program, <code>atlas</code>, reads five files kept in the repository and writes the JSON files these pages load. A GitHub Actions job runs it every day, commits the new data and publishes the site.</p>
      <h2>What changes every day</h2>
      <p><b>Papers.</b> For each field, two Europe PMC queries return the most cited open-access papers of all time and of the last 24 months. Each paper is tagged with tasks, from keyword patterns, and with the databases and datasets it names.</p>
      <p><b>New papers.</b> Every paper published in the last 60 days in the leading bioinformatics and computational biology journals is collected and sorted into fields and tasks. Nature, Science, Cell and Nature Communications are included only for computational papers. Abstracts are shown when the paper is open access or under a Creative Commons licence.</p>
      <p><b>Benchmarks.</b> Published results tables are downloaded and shown unchanged.</p>
      <p><b>Status.</b> Every source's website and the download link of its current release are requested once. Results are kept for 30 days.</p>
      <h2>Reproducing a build</h2>
      <p>Databases, releases and datasets come only from files in the repository, so a commit always gives the same <code>sources.json</code> and <code>datasets.json</code>. The daily job builds them twice with <code>atlas build --offline</code> and stops if the two outputs differ. Every build records the commit and the SHA-256 of each input:</p>
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
    </div>
  </section></div>`;
}

function pageSaved() {
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

function notFound(message) {
  view.innerHTML = `<div class="page"><section class="section"><h1>Not found</h1><p class="lede">${esc(message)}</p><a class="chip plain" href="#home">Back to the start</a></section></div>`;
}

// ---------- router ----------
function route() {
  stopLive();
  stopLive = () => {};
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

function initTheme() {
  let saved = "";
  try { saved = localStorage.getItem("atlas-theme") || ""; } catch (e) { /* storage blocked */ }
  if (saved) document.documentElement.dataset.theme = saved;
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("atlas-theme", root.dataset.theme); } catch (e) { /* storage blocked */ }
    clearThumbs();
    route();
  });
}


async function load(name) {
  const res = await fetch(`data/${name}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
  return res.json();
}

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
  setTimeout(() => Promise.all([needTables(), need("boards")]).then(([t, b]) => { buildBenchIndex(t, b?.boards || []); searchIndex = null; palette.refresh(); }).catch(() => {}), 2500);
}

// Back to top, shown after the reader scrolls a screen.
const toTop = document.getElementById("to-top");
window.addEventListener("scroll", () => { toTop.hidden = window.scrollY < window.innerHeight; }, { passive: true });
toTop.addEventListener("click", () => { window.scrollTo({ top: 0, behavior: "smooth" }); view.focus({ preventScroll: true }); });

start();
