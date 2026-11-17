// Any unknown route.
import { view, esc } from "../core/dom.js";

export function notFound(message) {
  view.innerHTML = `<div class="page"><section class="section"><h1>Not found</h1><p class="lede">${esc(message)}</p><a class="chip plain" href="/">Back to the start</a></section></div>`;
}
