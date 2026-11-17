// Each page may start live drawings (3D figures, the cell animation). The
// router stops them before it draws the next page.
let stop = () => {};
export const setStop = (fn) => { stop = typeof fn === "function" ? fn : () => {}; };
export const stopPage = () => { stop(); stop = () => {}; };
