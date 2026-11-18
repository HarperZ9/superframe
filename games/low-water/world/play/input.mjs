// What the player asks for, from whatever they hold: keys and a mouse, a gamepad, or a phone's
// touch sticks. A host reads its devices into one plain record each frame (no device objects
// here), and this turns it into the intent the body and the camera read.
//   raw: { keys: Set of key codes held, pressed: Set of key codes pressed this frame,
//          mouse: [dx, dy] pixels since the last frame (only while the pointer is held),
//          wheel: steps, pad: null | { axes: [lx, ly, rx, ry], buttons: [bool...], pressed: Set of indices },
//          touch: null | { move: [x, y] -1..1, look: [dx, dy] pixels }, ui: null | "nav" | "follow" | "first" | "iso" }
// Gamepad buttons follow the standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT,
// 10 left stick, 12 to 15 the d-pad.
export const KEYS = {
  forward: ["KeyW", "ArrowUp"], back: ["KeyS", "ArrowDown"], left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
  run: ["ShiftLeft", "ShiftRight"], rise: ["Space"], sink: ["KeyC"], cycle: ["KeyV"], nav: ["KeyF"], reach: ["KeyE"], turnIso: ["KeyR"],
};
const MOUSE = 0.0022, STICK = 2.8, TOUCH = 0.006, DEAD = 0.16;
const any = (set, list) => list.some((k) => set.has(k));
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export function readIntent(raw, dt, mode) {
  const k = raw.keys || new Set(), p = raw.pressed || new Set(), pad = raw.pad, t = raw.touch;
  let mx = (any(k, KEYS.right) ? 1 : 0) - (any(k, KEYS.left) ? 1 : 0), my = (any(k, KEYS.back) ? 1 : 0) - (any(k, KEYS.forward) ? 1 : 0);
  let lx = (raw.mouse ? raw.mouse[0] : 0) * MOUSE, ly = (raw.mouse ? raw.mouse[1] : 0) * MOUSE;
  let run = any(k, KEYS.run), rise = (any(k, KEYS.rise) ? 1 : 0) - (any(k, KEYS.sink) ? 1 : 0), zoom = raw.wheel || 0;
  let cycle = any(p, KEYS.cycle), nav = any(p, KEYS.nav), reach = any(p, KEYS.reach), turnIso = any(p, KEYS.turnIso) ? 1 : 0;
  if (pad) {
    const a = pad.axes || [], b = pad.buttons || [], pp = pad.pressed || new Set();
    mx += dz(a[0] || 0); my += dz(a[1] || 0);
    lx += dz(a[2] || 0) * STICK * dt; ly += dz(a[3] || 0) * STICK * dt;
    run = run || !!b[10] || !!b[7];
    rise += (b[5] ? 1 : 0) - (b[4] ? 1 : 0);
    if (pp.has(3)) cycle = true;
    if (pp.has(0)) reach = true;
    if (pp.has(12)) zoom -= 1; if (pp.has(13)) zoom += 1;
    if (pp.has(15)) turnIso += 1; if (pp.has(14)) turnIso += 3;
  }
  if (t) {
    mx += t.move[0]; my += t.move[1];
    lx += (t.look[0] || 0) * TOUCH; ly += (t.look[1] || 0) * TOUCH;
    // a stick pushed to its rim runs
    if (Math.hypot(t.move[0], t.move[1]) > 0.92) run = true;
  }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  return { move: [mx, my], look: [lx, ly], run, fast: run, rise, zoom, cycle, nav, reach, turnIso, ui: raw.ui || null, mode };
}
// The stick turned onto the map by the camera's heading: forward is the way the camera looks.
export function mapMove(move, yaw) {
  const f = [Math.sin(yaw), -Math.cos(yaw)], r = [Math.cos(yaw), Math.sin(yaw)];
  return [r[0] * move[0] - f[0] * move[1], r[1] * move[0] - f[1] * move[1]];
}
