// The game as the shell and the tools run it: the engine (game.mjs) plus the combat layer
// (game/engine/combat/, the combat engineer's: G.ext.combat, loop system at order 20). Kept
// apart from game.mjs so the engine, its tests and the validator load even while combat is
// being edited; createGame alone has no combat, and combat's own tests install it themselves.
import { createGame, loadContent } from "./game.mjs";
import { installCombat } from "./combat/encounter.mjs";

export { loadContent };
export function createFullGame(opts = {}) { const G = createGame(opts); installCombat(G); return G; }
