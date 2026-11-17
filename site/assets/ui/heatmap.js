// Fields as a clustered heatmap: rows are fields in dendrogram order, columns
// are databases, datasets and new papers. Every cell links to that list.
import { esc, num } from "../core/dom.js";
import { baseVar } from "../core/catalog.js";

const ROW = 40;     // px per row, shared by the cells and the dendrogram
const TREE_W = 64;  // px of dendrogram

// Elbow dendrogram: leaves at the right edge, the root towards the left.
function dendrogram(tree, order) {
  const y = new Map(order.map((leaf, i) => [leaf, (i + 0.5) * ROW]));
  const maxH = tree.height || 1;
  const x = (h) => TREE_W - 2 - (h / maxH) * (TREE_W - 6);
  const paths = [];
  const walk = (n) => {
    if (!n.left) return { x: TREE_W, y: y.get(n.leaves[0]) };
    const a = walk(n.left), b = walk(n.right), nx = x(n.height);
    paths.push(`M${a.x} ${a.y}H${nx}V${b.y}H${b.x}`);
    return { x: nx, y: (a.y + b.y) / 2 };
  };
  walk(tree);
  return `<svg class="hm-tree" width="100%" height="${order.length * ROW}" viewBox="0 0 ${TREE_W} ${order.length * ROW}" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="${paths.join("")}"/></svg>`;
}

export function fieldHeatmap(m) {
  const head = m.columns.map((c) => `<span class="hm-col" role="columnheader">${esc(c)}</span>`).join("");
  const rows = m.order.map((i) => {
    const r = m.rows[i];
    return `<div class="hm-row" role="row">${r.cells.map((c) => c.n == null
      ? `<span class="hm-cell pending" role="cell"><span>…</span></span>`
      : `<a class="hm-cell${c.v > 0.62 ? " deep" : ""}" role="cell" href="${esc(c.href)}" style="--v:${c.v.toFixed(3)}" aria-label="${esc(`${num(c.n)} ${c.kind} in ${r.field.label}`)}">${num(c.n)}</a>`).join("")}
      <a class="hm-field" role="rowheader" href="#sources/${esc(r.field.id)}" style="--dot:${baseVar(r.field)}">${esc(r.field.label)}</a>
    </div>`;
  }).join("");
  return `<figure class="heatmap">
    <div class="hm-grid">
      ${dendrogram(m.tree, m.order)}
      <div class="hm-table" role="table" aria-label="What the atlas holds per field">
        <div class="hm-row hm-head" role="row">${head}<span class="hm-col hm-fieldcol" role="columnheader">Field</span></div>
        ${rows}
      </div>
    </div>
    <figcaption class="hm-caption">
      <span class="hm-scale" aria-hidden="true"><span>Fewer</span><i></i><span>More</span></span>
      <span>Shade compares fields within each column. Fields with a similar profile are clustered together.</span>
    </figcaption>
  </figure>`;
}
