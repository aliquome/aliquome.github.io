// The download-code panel (link, tabs per language) and library loaders.
import { esc, safe, copy } from "../core/dom.js";
import { findLoader } from "../core/catalog.js";
import { HOSTS, snippets } from "../domain/links.js";

// A loader is a library call or official client command from data/loaders.toml.
export const loaderLink = (l, key, name) =>
  `${safe(l.docs) ? `<a href="${esc(l.docs)}" target="_blank" rel="noopener">${esc(l.label)}</a>` : `<span>${esc(l.label)}</span>`}<button type="button" data-loader="${esc(key)}" data-label="${esc(name + ", " + l.label)}">code</button>`;

export function loaderPanel(l, title) {
  const id = `p${++panelSeq}`;
  return `<div class="get" data-panel="${id}">
    <div class="get-head"><span class="label">${esc(title)}</span><span class="hint">Runs the library or official client, which downloads the data for you.</span></div>
    <div class="code" data-pane="${id}-0"><div class="code-bar"><span>${esc(l.label)}</span><button class="btn small" type="button" data-copy-pre>Copy</button></div><pre>${esc(l.code)}</pre></div>
    ${safe(l.docs) ? `<p class="hint">Documentation: <a href="${esc(l.docs)}" target="_blank" rel="noopener">${esc(l.docs)}</a></p>` : ""}
  </div>`;
}

export let panelSeq = 0;

export function codePanel(url, type, title) {
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
