// The five verbs on the existing outcomes (design/spine-plan/inferno/06-SYSTEMS.md section 2), shared by the
// inner bosses (combat/arena/innerworld.mjs) and the Adversary's movements (combat/arena/hostworld.mjs).
//   refuse  the flaw's own door: the world's flight rule (30 frames steering inside it) ends as `fled`
//   endure  survive the pattern without landing a blow: `rounds` boss rests in a row with none landed; `endured`
//   yield   lay the tool down (guard and interact held LAY.frames), then the flaw's act; `laid`
//   lose    go down: the world's `down`; the inner run plays the loss beat and goes on to the morning
//   name    face it: drop the guard and stand still NAME.hold frames with the world running and its blows
//           coming; moving or pressing anything cancels; `talk`
// None of them heals (DECISIONS 4); the next scene plays the outcome's beat.
import { VERBS } from "../data/flaws-common.mjs";

export const LAY = { frames: 60 }; // V3: 1.0 s
export const NAME = { hold: 90 }; // V5: 1.5 s, standing still
export const MORPH = { quiet: 50 }; // F3: frames after a morph in which no hand strikes (the boss roars through them)
// the presses a laid tool refuses: every strike
const STRIKES = new Set(["light", "heavy", "art", "art2", "grapple", "shove", "riposte", "use"]);
const still = (inp) => Math.hypot(inp.mx || 0, inp.mz || 0) <= 0.2;

export const verbOf = (outcome) => Object.entries(VERBS).find(([, o]) => o === outcome)?.[0] || (outcome === "forced" ? "force" : null);

// Lamb's input this frame, read for the verbs before the world sees it: the lay hold, the strikes a laid
// tool refuses, and the stand-still clock of facing it. Returns the input the world steps with.
export function readLamb(W, inp0 = {}) {
  const I = W.inner, inp = { ...inp0, press: [...(inp0.press || [])], hold: { ...(inp0.hold || {}) } };
  const L = W.lamb();
  if (!I.laid && I.open !== false) { // the optional layers open only once the fight is joined (innerworld.mjs I.open)
    I.lay = inp.hold.block && inp.hold.interact ? I.lay + 1 : 0;
    if (I.lay >= LAY.frames) { I.laid = true; I.layAt = W.tick + 1; if (L) { I.toolLaid = L.tool; L.tool = null; } W.emit({ type: "laid", id: "lamb" }); I.say && I.say("laid"); }
  }
  if (I.laid) { inp.press = inp.press.filter((a) => !STRIKES.has(a)); inp.hold.heavy = false; }
  if (I.nameable && I.open !== false) nameStep(W, inp);
  return inp;
}

// Facing it: "name" starts the clock over the live fight (the world keeps running); NAME.hold frames standing
// still, with no other press, ends it (onNamed); a move or a press cancels.
function nameStep(W, inp) {
  const I = W.inner;
  if (!I.naming && inp.press.includes("name")) { I.naming = { t: 0, target: I.nameTarget ? I.nameTarget(W) : null }; W.emit({ type: "naming", target: I.naming.target }); inp.press = inp.press.filter((a) => a !== "name"); return; }
  const N = I.naming; if (!N) return;
  if (!still(inp) || inp.press.length) { I.naming = null; W.emit({ type: "naming.broken", target: N.target }); return; }
  N.t++; inp.mx = 0; inp.mz = 0;
  if (N.t >= (I.nameHold || NAME.hold)) { I.naming = null; W.emit({ type: "named", target: N.target }); if (I.onNamed) I.onNamed(W, N.target); }
}

// End an inner fight as an outcome, with its verb (or force) and why; replaces any result the world set
export function endAs(W, outcome, reason) {
  const I = W.inner;
  W.result = { outcome, reason, tick: W.tick, verb: verbOf(outcome), flaw: I.flaw, inner: true };
  W.emit({ type: "end", outcome, reason, inner: true });
  return W.result;
}

// The world's own result, read as an inner outcome: a boss brought down is `forced`, never `win` (the ruling
// in combat/PROGRESS.md 29); flight through the flaw's door is refuse; down is lose.
export function convertResult(W) {
  const R = W.result; if (!R || R.inner) return;
  if (R.outcome === "win" || R.outcome === "yield") return endAs(W, "forced", "fall");
  return endAs(W, R.outcome, R.reason);
}

// Endure: count the boss's rests while no blow of Lamb's has landed on its side since the last one
export function endureStep(W, ev, rounds) {
  const I = W.inner;
  for (const e of ev) {
    if (e.type === "hit" && e.by === "lamb") I.rested = 0;
    if (e.type === "boss.rest" && I.bossIds.includes(e.id)) { I.rested++; W.emit({ type: "endure", n: I.rested, of: rounds }); }
  }
  return rounds > 0 && I.rested >= rounds;
}
