// Pure: the site's addresses. Pages speak in routes, "page/a/b" (the words the
// router dispatches on, e.g. "source/gnomad" or "benchmarks/model/chembfn");
// the address bar, links and search engines see clean paths:
//
//   home                      /
//   sources[/field]           /db/[?field=]
//   source/<id>               /db/<id>/
//   datasets[/field[/text]]   /datasets/[?field=&q=]   or /datasets/<slug>/ for a dataset
//   latest[/field[/task]]     /papers/[?field=&task=]
//   papers[/field]            /papers/top/[?field=]
//   benchmarks[/field[/text]] /benchmarks/[?field=&q=]
//   benchmarks/<table|board>  /benchmarks/<id>/
//   benchmarks/models[/text]  /models/[?q=]
//   benchmarks/model/<key>    /models/<key>/
//   benchmarks/papers[/text]  /benchmarks/papers/[?q=]
//   benchmarks/paper/<key>    /benchmarks/paper/<key>/
//   benchmarks/dataset/<key>  /benchmarks/dataset/<key>/
//   status, about, saved      /status/, /about/, /saved/
//
// Every path has a page on disk (written by scripts/static-pages.mjs), so a
// reload or a link from elsewhere works on a static host.

export const PAGES = ["home", "sources", "source", "datasets", "latest", "papers", "benchmarks", "status", "about", "saved"];

let fieldIds = new Set();
let slugOfName = new Map();
let nameOfSlug = new Map();

// What the mapping needs to know from the data: field ids, and the slug of
// every dataset name (from keyed() over all names, as the page writer uses).
export function configurePaths({ fields = [], datasetSlugs = new Map() } = {}) {
  fieldIds = new Set(fields);
  slugOfName = new Map(datasetSlugs);
  nameOfSlug = new Map([...datasetSlugs].map(([name, slug]) => [slug, name]));
}
export const datasetSlug = (name) => slugOfName.get(name);

const enc = encodeURIComponent;
const query = (pairs) => {
  const q = pairs.filter(([, v]) => v).map(([k, v]) => `${k}=${enc(v)}`).join("&");
  return q ? `?${q}` : "";
};

// "#source/gnomad", "source/gnomad" or ["source", "gnomad"] -> "/db/gnomad/"
export function toPath(route) {
  const parts = Array.isArray(route) ? route : String(route ?? "").replace(/^#/, "").split("/").map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  const [page = "home", a = "", b = ""] = parts;
  switch (page) {
    case "": case "home": return "/";
    case "sources": return `/db/${query([["field", a]])}`;
    case "source": return a ? `/db/${enc(a)}/` : "/db/";
    case "datasets": {
      const slug = b && slugOfName.get(b);
      return slug ? `/datasets/${slug}/` : `/datasets/${query([["field", a], ["q", b]])}`;
    }
    case "latest": return `/papers/${query([["field", a], ["task", b]])}`;
    case "papers": return `/papers/top/${query([["field", a]])}`;
    case "benchmarks":
      if (!a) return `/benchmarks/${query([["q", b]])}`;
      if (a === "models") return `/models/${query([["q", b]])}`;
      if (a === "model") return b ? `/models/${enc(b)}/` : "/models/";
      if (a === "papers") return `/benchmarks/papers/${query([["q", b]])}`;
      if (a === "paper" || a === "dataset") return b ? `/benchmarks/${a}/${enc(b)}/` : "/benchmarks/";
      if (fieldIds.has(a)) return `/benchmarks/${query([["field", a], ["q", b]])}`;
      return `/benchmarks/${enc(a)}/`;
    case "status": case "about": case "saved": return `/${page}/`;
    default: return null;
  }
}

// "/db/gnomad/" (+ "?field=…") -> ["source", "gnomad"]; null when the path is
// not a page of the site.
export function fromPath(pathname, search = "") {
  let segs;
  try { segs = String(pathname || "/").replace(/index\.html$/, "").split("/").filter(Boolean).map(decodeURIComponent); } catch { return null; }
  const q = new URLSearchParams(search || "");
  const field = q.get("field") || "", text = q.get("q") || "";
  const [s0, s1, s2] = segs;
  if (segs.length === 0) return ["home"];
  switch (s0) {
    case "db": return segs.length === 1 ? ["sources", field] : segs.length === 2 ? ["source", s1] : null;
    case "datasets":
      if (segs.length === 1) return ["datasets", field, text];
      if (segs.length === 2) { const name = nameOfSlug.get(s1); return name ? ["datasets", "", name] : ["datasets", "", s1.replace(/-/g, " ")]; }
      return null;
    case "papers":
      if (segs.length === 1) return ["latest", field, q.get("task") || ""];
      if (segs.length === 2 && s1 === "top") return ["papers", field];
      return null;
    case "benchmarks":
      if (segs.length === 1) return ["benchmarks", field, text];
      if (segs.length === 2) return s1 === "papers" ? ["benchmarks", "papers", text] : ["benchmarks", s1];
      if (segs.length === 3 && (s1 === "paper" || s1 === "dataset")) return ["benchmarks", s1, s2];
      return null;
    case "models":
      if (segs.length === 1) return ["benchmarks", "models", text];
      if (segs.length === 2) return ["benchmarks", "model", s1];
      return null;
    case "status": case "about": case "saved": return segs.length === 1 ? [s0] : null;
    default: return null;
  }
}

// An old address "#source/gnomad" from links made before clean paths.
export function isRouteHash(hash) {
  const page = String(hash || "").replace(/^#/, "").split("/")[0];
  return PAGES.includes(page);
}
