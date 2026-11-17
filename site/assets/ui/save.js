// Save buttons and the saved-items counter in the header.
import { esc, toast } from "../core/dom.js";
import { saveItem } from "../core/catalog.js";
import { saved } from "../services/library.js";

export function saveBtn(kind, id, label = "") {
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

export function updateSavedCount() {
  const n = saved.all().length;
  const el = document.getElementById("saved-n");
  el.textContent = n;
  el.hidden = n === 0;
}

saved.onChange(updateSavedCount);
