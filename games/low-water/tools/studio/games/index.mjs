// The games the Studio can open, by name (?game=... in the browser, --game ... on the command line).
// A new game adds a config file beside these and a line here; the Studio's core reads only the config.
export const GAMES = { quota: () => import("./quota.mjs"), lowwater: () => import("./lowwater.mjs") };
