// The harness's inner fights (tools/playthrough.mjs): a story beat.inner (combat/innerhook.mjs) played headless and
// its records handed back to the story with talk.afterInner. The fight runs in its own small world (the combat test
// game: the inner arena is a dream and reads nothing of the town), so the story's state changes only by the records.
// How each build plays it: a fist build fights (force); any other ends it the way the flaw allows without force, in
// the order endure, yield, refuse, name; the Adversary's first movement is endured and the other two are named. An
// offer after force is declined (a boon is a policy question for the story, not the harness). The Descent's rings are
// fought where a flaw returns and walked where the ring is snow.
//   playInner(inner, { habit, seed }) -> { records, ends, secs (the simulated seconds fought) }
import { makeG } from "../combat/tests/helpers.mjs";
import { FLAWS } from "../combat/data/flaws.mjs";
import { createInnerRun } from "../combat/arena/inner.mjs";
import { createDescent } from "../combat/arena/descent.mjs";
import { forceBot, resolveBot } from "../combat/tools/innerbots.mjs";

const LEVELS = { grip: 5, ballast: 5, coat: 5, knees: 5, pen: 4, nose: 4 }, LIMIT = 60 * 240;
// the story's sheet when the hinge sent it (combat/innerhook.mjs): the trait is as strong in the dream as in him
// (design/TRAITS.md section 2); the fixed build fills what the sheet does not name
const levelsOf = (inner) => ({ ...LEVELS, ...(inner.levels || {}) });
const toward = (key) => (W) => { const [x, z] = W.field.arena.anchors[key][0], L = W.lamb(), d = Math.hypot(x - L.x, z - L.z) || 1; return { mx: (x - L.x) / d, mz: (z - L.z) / d }; };
let frames = 0; // the simulated frames of every fight played, for tools/playtime.mjs
const play = (W, bot) => { let i = 0; for (; i < LIMIT && !W.result; i++) W.step({ lamb: bot(W) }); frames += i; return W.result ? W.result.outcome : "running"; };
export const verbFor = (flaw, habit) => (habit === "fist" ? "force" : ["endure", "yield", "refuse", "name"].find((v) => flaw.verbs[v]) || "lose");

export function playInner(inner, { habit = "tongue", seed = 1 } = {}) {
  const records = [], ends = [], onRecord = (e) => records.push(e), heard = inner.heard || []; frames = 0;
  if (inner.id === "descent") {
    const D = createDescent({ resolved: inner.resolved || {}, heard, levels: levelsOf(inner), seed, onRecord });
    while (D.stage().kind === "ring") { const st = D.stage(), W = D.world(makeG()); ends.push(play(W, st.empty ? toward("stove") : forceBot())); D.finish(W); }
    return { records, ends, secs: frames / 60 };
  }
  const R = createInnerRun({ flaw: inner.id, heard, kept: inner.kept || [], levels: levelsOf(inner), seed, onRecord });
  while (R.stage().kind === "fight") {
    const st = R.stage(), W = R.world(makeG());
    const verb = inner.id === "host" ? (st.movement === 0 ? "endure" : "name") : verbFor(FLAWS[inner.id], habit);
    ends.push(play(W, verb === "force" ? forceBot() : resolveBot(W, verb))); R.finish(W);
    if (R.stage().kind === "offer") R.choose(1);
  }
  R.wake();
  return { records, ends, secs: frames / 60 };
}
