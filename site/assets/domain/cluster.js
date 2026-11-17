// Pure: average-linkage (UPGMA) hierarchical clustering, as used for the
// row dendrogram of an expression heatmap. Small inputs only (tens of rows).
const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

// vectors: number[][] -> tree of { leaves, height, left, right }
export function upgma(vectors) {
  const avg = (a, b) => {
    let s = 0;
    for (const i of a.leaves) for (const j of b.leaves) s += dist(vectors[i], vectors[j]);
    return s / (a.leaves.length * b.leaves.length);
  };
  let nodes = vectors.map((_, i) => ({ leaves: [i], height: 0, left: null, right: null }));
  while (nodes.length > 1) {
    let best = null;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = avg(nodes[i], nodes[j]);
        if (!best || d < best.d - 1e-12) best = { i, j, d };
      }
    }
    const a = nodes[best.i], b = nodes[best.j];
    const merged = { leaves: [...a.leaves, ...b.leaves], height: best.d / 2, left: a, right: b };
    nodes = nodes.filter((_, k) => k !== best.i && k !== best.j).concat(merged);
  }
  return nodes[0];
}

// Leaves from top to bottom, the order the heatmap rows follow.
export const leafOrder = (node) => (node.left ? [...leafOrder(node.left), ...leafOrder(node.right)] : node.leaves);
