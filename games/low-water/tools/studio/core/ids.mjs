// Material ids by what a painter calls them, from the game's config (games/<name>.mjs ids): skin, eye,
// white, lip, brow, hair, hat, collar, coat. Read at the moment of use, so switching games switches them.
import { game } from "./game.mjs";
export const IDS = new Proxy({}, { get: (_, k) => game().ids[k] || [] });
