// #status
import { view, esc } from "../core/dom.js";
import { S } from "../core/store.js";
import { STATE_LABEL, statusOf } from "../core/catalog.js";
import { dot, history } from "../ui/status.js";

export function pageStatus() {
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
