// Navigation for modules below the app layer: the router registers itself
// here, so services and pages can move to a route without importing it.
let navigator = (url) => location.assign(url);

export const setNavigator = (fn) => { navigator = fn; };

// A route ("source/gnomad", "#source/gnomad") or a path ("/db/gnomad/").
export const go = (target) => navigator(target);
