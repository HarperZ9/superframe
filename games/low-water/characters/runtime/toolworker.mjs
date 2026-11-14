// The tool worker (module worker): the search for a held tool's wrist and arm pose (runtime/toolclear.mjs)
// run whole, off the main thread. The drawer (runtime/fightdrawer.mjs keepToolClear) sends a figure's pose
// without the tool layer, its foot locks, its place and the limits; the answer is the target the drawer
// eases toward. The same code as the drawer's own search, on a stand-in actor of the same body and tool.
//   { type: "init", timing, combat }                      the cast's timing, as the drawer loaded it
//   { type: "tool", id, seq, who, tool, base, locks, facing, pos, fx, fz, R, crop, near, st }
//     -> { type: "tool", id, seq, tb, ts, to, ms, tries }
import { createCast, addPose } from "./actor.mjs";
import { CAST } from "./castmap.mjs";
import { placeFn } from "../render/raster.mjs";
import { toolStep, toolOff } from "./toolclear.mjs";

let cast = null; const actors = new Map();
const actorOf = (who, tool) => { const k = `${who}|${tool}`; let a = actors.get(k); if (!a) actors.set(k, (a = cast.actor(who, { tool }))); return a; };

// blocked(x, z) from the crop of the walk grid the drawer sent (the same cells groundAt reads)
export function blockedOf(C) {
  if (!C) return null;
  return (x, z) => {
    const ci = Math.floor((x - C.ox) / C.c), ri = Math.floor((z - C.oz) / C.c);
    if (ci < 0 || ri < 0 || ci >= C.w || ri >= C.h) return true;   // off the grid: no ground
    const i = ci - C.c0, j = ri - C.r0;
    return i < 0 || j < 0 || i >= C.cw || j >= C.ch ? true : !!C.bits[j * C.cw + i];
  };
}

export function searchTool(a, m, count = null) {
  const toW = placeFn(m.facing, m.pos).p;
  const env = {
    measure: (off) => { const S = a.skeleton(off ? addPose(m.base, toolOff(off[0], off[1], off[2])) : m.base, m.locks); return { w: a.weapon(S, toW), S, toWorld: toW }; },
    pos: m.pos, fx: m.fx, fz: m.fz, R: m.R, blocked: blockedOf(m.crop), near: m.near,
  };
  const st = { tb: m.st.tb, ts: m.st.ts, to: m.st.to, search: null };
  toolStep(env, st, Infinity, count);
  return st;
}

if (typeof self !== "undefined" && typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === "init") { cast = createCast({ timing: m.timing, combat: m.combat, members: CAST }); return; }
    if (m.type !== "tool") return;
    try {
      const t0 = performance.now(), count = { tries: 0 }, st = searchTool(actorOf(m.who, m.tool), m, count);
      self.postMessage({ type: "tool", id: m.id, seq: m.seq, tb: st.tb, ts: st.ts, to: st.to, ms: performance.now() - t0, tries: count.tries });
    } catch (err) { self.postMessage({ type: "tool", id: m.id, seq: m.seq, error: err.message }); }
  };
}
