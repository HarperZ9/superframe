// The game the Studio is working on: its config (games/<name>.mjs) is the only place the core learns a
// game's cast, materials, head construction, light, export paths and peoples. Defaults to The Quota.
//   game() -> config    useGame(nameOrConfig) -> config    loadCastFor(cfg) -> { members, timing }
import quota from "../games/quota.mjs";
import { GAMES } from "../games/index.mjs";
import { setDefaultEra } from "./cast.mjs";

let current = quota; const listeners = [];
export const game = () => current;
export const onGame = (fn) => { listeners.push(fn); fn(current); };   // modules that keep a game's values as constants
export async function useGame(which) {
  if (typeof which === "string" && !GAMES[which]) throw new Error(`studio: no game "${which}" (games/index.mjs lists ${Object.keys(GAMES).join(", ")})`);
  const cfg = typeof which === "string" ? (await GAMES[which]()).default : which;
  current = cfg; setDefaultEra(cfg.export?.defaultEra ?? 1); for (const fn of listeners) fn(cfg); return cfg;
}
export async function loadCastFor(cfg = current) {
  const members = await cfg.members();
  const timing = globalThis.process?.versions?.node
    ? JSON.parse((await import("node:fs")).readFileSync(new URL(cfg.timing), "utf8"))
    : await (await fetch(cfg.timing)).json();
  return { members, timing };
}
