// Debug views, off in play: ?debug=nav,hits on the page, or globalThis.__lwDebug = { nav: true } at run time.
//   nav   the visibility graph and the paths people walk (ui/navdebug.mjs)
//   hits  hit and hurt volumes in a fight (ui/hitdebug.mjs)
export function debugOn(name) {
  const g = globalThis.__lwDebug; if (g && name in g) return !!g[name];
  try { return (new URLSearchParams(location.search).get("debug") || "").split(",").includes(name); } catch (e) { return false; }
}
