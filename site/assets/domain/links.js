// Pure: what kind of link a URL is, and the download code for it.

export const fileName = (url) => {
  const last = url.split("?")[0].replace(/\/+$/, "").split("/").pop() || "download";
  return last.includes("{") ? "download" : last;
};

// Record pages on data-hosting services are fetched with that service's own
// client or API, so they get code too, not only direct file links.
export const HOSTS = {
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

export const hostOf = (url) => Object.keys(HOSTS).find((k) => HOSTS[k].test(url));

export const hostId = (url, k) => (url.match(HOSTS[k]) || []).slice(1).filter(Boolean);

// A release stored as "portal" may still sit on a host with its own client.
export const typeOf = (url, t) => (!t || t === "portal" || t === "none" ? inferType(url || "") : t);

export function inferType(url) {
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

export function snippets(url, type) {
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
