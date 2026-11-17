// Shared helpers: the reader's saved items, citation export and the
// site-wide search palette. Saved items live in this browser only.
import { go } from "../core/nav.js";

const KEY = "atlas-saved-v1";
const listeners = new Set();

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* storage blocked */ }
  listeners.forEach((fn) => fn(items));
}

export const saved = {
  all: read,
  has: (key) => read().some((x) => x.key === key),
  toggle(item) {
    const items = read();
    const i = items.findIndex((x) => x.key === item.key);
    if (i >= 0) items.splice(i, 1);
    else items.unshift({ ...item, savedAt: new Date().toISOString() });
    write(items);
    return i < 0;
  },
  remove(key) { write(read().filter((x) => x.key !== key)); },
  clear() { write([]); },
  onChange(fn) { listeners.add(fn); },
};

// ---------- citations ----------
const clean = (s) => String(s || "").replace(/[{}\\]/g, "").trim();

export function bibtex(p) {
  const first = clean((p.authors || "").split(",")[0]).split(/\s+/)[0] || "paper";
  const key = `${first}${p.year || ""}${clean(p.title).split(/\s+/)[0] || ""}`.replace(/[^A-Za-z0-9]/g, "");
  const authors = (p.authors || "").replace(/\.$/, "").split(/,\s*/).filter(Boolean).join(" and ");
  const fields = [
    ["title", `{${clean(p.title).replace(/\.$/, "")}}`],
    ["author", `{${clean(authors)}}`],
    ["journal", `{${clean(p.journal)}}`],
    ["year", `{${clean(p.year)}}`],
    p.doi && ["doi", `{${clean(p.doi)}}`],
    ["url", `{${clean(p.url)}}`],
  ].filter(Boolean);
  return `@article{${key},\n${fields.map(([k, v]) => `  ${k} = ${v}`).join(",\n")}\n}`;
}

export function manifest(items) {
  const rows = items.filter((x) => x.type !== "paper").map((x) => [x.type, x.title, x.version || "", x.url || ""]);
  return ["type\tname\tversion\turl", ...rows.map((r) => r.map((c) => String(c).replace(/\t/g, " ")).join("\t"))].join("\n");
}

export function downloadText(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- search palette ----------
// getIndex() returns [{ kind, title, sub, href, text }] built from the
// loaded data; papers are added once they have been fetched.
export function mountPalette(getIndex, esc) {
  const dlg = document.getElementById("palette");
  const input = document.getElementById("palette-q");
  const list = document.getElementById("palette-list");
  let hits = [], pos = 0;

  const score = (item, terms) => {
    let s = 0;
    for (const t of terms) {
      const i = item.title.toLowerCase().indexOf(t);
      if (i === 0) s += 6; else if (i > 0) s += 3;
      else if (item.text.includes(t)) s += 1;
      else return 0;
    }
    return s + (item.kind === "Database" ? 1.5 : item.kind === "Release" ? 1 : 0);
  };

  const render = () => {
    const q = input.value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    if (!terms.length) {
      hits = getIndex().filter((x) => x.kind === "Page");
    } else {
      hits = getIndex()
        .map((x) => [score(x, terms), x])
        .filter(([s]) => s > 0)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 40)
        .map(([, x]) => x);
    }
    pos = 0;
    let group = "";
    list.innerHTML = hits.length
      ? hits.map((h, i) => {
          const head = h.kind !== group ? `<li class="pal-group" role="presentation">${esc(h.kind === "Page" ? "Go to" : h.kind + "s")}</li>` : "";
          group = h.kind;
          return `${head}<li role="option" id="pal-${i}" aria-selected="${i === 0}"><a href="${esc(h.href)}" data-i="${i}"><span>${esc(h.title)}</span><small>${esc(h.sub || "")}</small></a></li>`;
        }).join("")
      : `<li class="pal-empty">No match for “${esc(input.value)}”. Try a database, a release such as “Ensembl 116”, or a topic.</li>`;
    input.setAttribute("aria-activedescendant", hits.length ? "pal-0" : "");
  };

  const move = (d) => {
    if (!hits.length) return;
    list.querySelector(`[aria-selected="true"]`)?.setAttribute("aria-selected", "false");
    pos = (pos + d + hits.length) % hits.length;
    const el = document.getElementById(`pal-${pos}`);
    el.setAttribute("aria-selected", "true");
    el.scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", `pal-${pos}`);
  };

  const open = (text = "") => {
    if (!dlg.open) dlg.showModal();
    input.value = text;
    render();
    input.focus();
  };
  const close = () => dlg.open && dlg.close();

  input.addEventListener("input", render);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && hits[pos]) { e.preventDefault(); go(hits[pos].href); close(); }
  });
  list.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  document.addEventListener("keydown", (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || "");
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) { e.preventDefault(); open(); }
  });
  document.querySelectorAll("[data-open-search]").forEach((b) => b.addEventListener("click", () => open()));
  return { open, close, refresh: () => dlg.open && render() };
}
