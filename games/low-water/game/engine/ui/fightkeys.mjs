// Fight input into G.input. ux: the bindings now come from ui/bindings.mjs (remappable in Settings,
// Controls); the defaults keep the keyboard as combat's arena page has it (WASD move, J light,
// K heavy (hold to charge), L catch, Space roll, Shift step, I block (hold), E shove, G grapple,
// Q use, F work a prop, H lantern, T take a talk offer, Tab lock, [ ] switch the lock) and add the
// mouse (left light, right heavy). The pad default is the shoulder layout: RB light, RT heavy,
// LB block, LT catch, B roll, L3 step, R3 lock (right stick flick switches), A work a prop, X use,
// Y shove, d-pad up lantern, down talk, left grapple, Start pause. The shell's own uses of these
// keys wait while a fight is open (the listeners run first and stop the event).
//   const unbind = bindFightKeys(G, { onPause })
import { loadBindings, byCode, FIGHT_ACTIONS, keyName, padName } from "./bindings.mjs";

const HOLDS = new Set(FIGHT_ACTIONS.filter((a) => a[2] === "hold").map((a) => a[0]));

// The list the fight's key card shows, from the current bindings.
export function keyList(B = loadBindings()) {
  return FIGHT_ACTIONS.map(([id, label]) => [(B.key[id] || []).map(keyName).filter((v, i, a) => a.indexOf(v) === i).join(" ") || "unbound", label, (B.pad[id] || []).map(padName).join(" ")]);
}
export const KEY_LIST = keyList().map(([k, what]) => [k, what]);

export function bindFightKeys(G, { onPause = null } = {}) {
  const B = loadBindings(), K = byCode(B, "key"), P = byCode(B, "pad"), M = byCode(B, "mouse");
  const padPrev = [];
  let flick = 0;
  const act = (name, on) => {
    if (name === "pause") { if (on && onPause) onPause(); return; }
    if (HOLDS.has(name)) G.input.set(name, on);
    if (on) G.input.press(name);
  };
  const down = (e) => { const acts = K[e.code]; if (!acts) return; e.preventDefault(); e.stopPropagation(); if (!e.repeat) for (const a of acts) act(a, true); };
  const up = (e) => { const acts = K[e.code]; if (!acts) return; for (const a of acts) if (HOLDS.has(a)) G.input.set(a, false); };
  const mdown = (e) => { const acts = M[e.button]; if (!acts || e.target.closest(".f")) return; e.preventDefault(); for (const a of acts) act(a, true); };
  const mup = (e) => { const acts = M[e.button]; if (!acts) return; for (const a of acts) if (HOLDS.has(a)) G.input.set(a, false); };
  const menu = (e) => e.preventDefault();
  addEventListener("keydown", down, true); addEventListener("keyup", up, true);
  addEventListener("mousedown", mdown, true); addEventListener("mouseup", mup, true); addEventListener("contextmenu", menu, true);
  let raf = 0;
  const pad = () => {
    const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null;
    if (p) {
      p.buttons.forEach((b, i) => {
        const on = b.pressed || b.value > 0.5, acts = P[i];
        if (acts && on !== !!padPrev[i]) for (const a of acts) { if (HOLDS.has(a)) G.input.set(a, on); if (on && !HOLDS.has(a)) act(a, true); else if (on) G.input.press(a); }
        padPrev[i] = on;
      });
      // right stick flick switches the lock
      const rx = p.axes[2] || 0;
      if (Math.abs(rx) > 0.7 && !flick) { G.input.press(rx > 0 ? "next" : "prev"); flick = 1; } else if (Math.abs(rx) < 0.3) flick = 0;
    }
    raf = requestAnimationFrame(pad);
  };
  raf = requestAnimationFrame(pad);
  return () => {
    removeEventListener("keydown", down, true); removeEventListener("keyup", up, true);
    removeEventListener("mousedown", mdown, true); removeEventListener("mouseup", mup, true); removeEventListener("contextmenu", menu, true);
    cancelAnimationFrame(raf); for (const a of HOLDS) G.input.set(a, false);
  };
}
