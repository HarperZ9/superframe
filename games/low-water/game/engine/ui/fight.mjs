// Kept for the combat engineer's harness (combat/tools/fightview.mjs): openFight now mounts the
// in-world fight layer (ui/fightlayer.mjs) on the stage it is given. The play screen does not
// use this: there a fight plays inside the plate view, with no change of screen.
import { fightLayer } from "./fightlayer.mjs";

export function openFight(ctx, id, onDone, opts = {}) {
  return fightLayer(ctx, ctx.stage, id, onDone, { cam: opts.cam || null });
}
