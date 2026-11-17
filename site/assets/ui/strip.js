// The comparison column of a results table: a thin line from the worst result
// (left) to the best (right) with a dot for each model. The value itself sits
// in its own right-aligned column, so numbers line up down the table.
export const stripHead = () =>
  `<th class="cmp" scope="col"><span class="cmp-scale"><span>worst</span><span>best</span></span><span class="visually-hidden">Position between the worst and the best result</span></th>`;

export const stripCell = (p, leader = false) =>
  p == null
    ? `<td class="cmp"></td>`
    : `<td class="cmp"><span class="strip${leader ? " lead" : ""}" style="--p:${p.toFixed(3)}" role="img" aria-label="${Math.round(p * 100)}% of the way from the worst to the best result"><i></i></span></td>`;
