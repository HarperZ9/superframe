// The framing follow (world/camera.mjs framer; engine PROGRESS 37). Pure checks beside the browser probe
// (tools/camprobe.mjs): a view at rest under a breathing target stays still; a target that jumps (new fight
// bounds) is answered without a jump in the view's speed; centre and zoom move together. Control: the follow
// as it was (left and top damped to the target zoom's corner, the zoom eased apart, rounded every frame).
import { test } from "node:test";
import assert from "node:assert/strict";
import { framer, damp, frame } from "../world/camera.mjs";

const dims = { plateW: 4800, plateH: 2560, viewW: 1920, viewH: 1080 }, T = 0.25, dt = 1 / 60;
const target = (cx, cy, zoom) => { const w = dims.viewW / zoom, h = dims.viewH / zoom; return { zoom, w, h, left: Math.round(cx - w / 2), top: Math.round(cy - h / 2) }; };
function oldFollow() { const sm = {}; return (c, t) => { if (!c) { sm.l = { x: t.left, v: 0 }; sm.t = { x: t.top, v: 0 }; return { ...t }; } const zk = 1 - Math.exp(-6 * dt); const L = damp(sm.l, t.left, T, dt), Tp = damp(sm.t, t.top, T, dt); const zoom = Math.abs(t.zoom - c.zoom) < 1e-3 ? t.zoom : c.zoom + (t.zoom - c.zoom) * zk; return { ...t, zoom, left: Math.round(L), top: Math.round(Tp) }; }; }
const newFollow = () => { const F = framer(); return (c, t) => F.step(t, dt, T, dims, c); };
// a fixed world point's screen position under a frame
const screen = (f, p = [2400, 1300]) => [(p[0] - f.left) * f.zoom, (p[1] - f.top) * f.zoom];
function play(follow, targets) { let c = null; const out = []; for (const t of targets) { c = follow(c, t); out.push(screen(c)); } return out; }
const moves = (s) => s.slice(1).map((p, i) => Math.hypot(p[0] - s[i][0], p[1] - s[i][1]));
const steps = (s) => { const v = s.slice(1).map((p, i) => [p[0] - s[i][0], p[1] - s[i][1]]); return v.slice(1).map((q, i) => Math.hypot(q[0] - v[i][0], q[1] - v[i][1])); };

test("at rest under a breathing target (1 plate px of sway, the corner rounded, the zoom 0.1%) the view does not move", () => {
  const tg = Array.from({ length: 600 }, (_, i) => target(2400 + 1.0 * Math.sin(i * 0.3), 1300 + 1.0 * Math.cos(i * 0.21), 2.2 + 0.002 * Math.sin(i * 0.17)));
  const s = play(newFollow(), tg).slice(120);
  assert.ok(Math.max(...moves(s)) <= 0.5, `moved ${Math.max(...moves(s)).toFixed(2)} px`);
  const o = play(oldFollow(), tg).slice(120);
  assert.ok(Math.max(...moves(o)) > 1.5, "control: the old follow moves on the same target");
});

test("new bounds: a target that jumps 120 plate px and 10% closer: no jump in speed over 2 px a frame on the eased path, the shown view within a plate pixel of it", () => {
  const tg = Array.from({ length: 240 }, (_, i) => (i < 60 ? target(2400, 1300, 2) : target(2520, 1340, 2.2)));
  const F = framer(); let c = null; const eased = [], dev = [];
  for (const t of tg) { c = F.step(t, dt, T, dims, c); const e = c.eased || [c.left, c.top]; eased.push(screen({ ...c, left: e[0], top: e[1] })); dev.push(Math.max(Math.abs(c.left - e[0]), Math.abs(c.top - e[1]))); }
  const worst = Math.max(...steps(eased));
  assert.ok(worst <= 2, `speed jumped ${worst.toFixed(2)} px a frame`);
  assert.ok(Math.max(...dev) <= 0.61, `shown ${Math.max(...dev).toFixed(2)} plate px from the eased path`);
  const o = Math.max(...steps(play(oldFollow(), tg)));
  assert.ok(o > 2, `control: the old follow jumps ${o.toFixed(2)}`);
  // it arrives: within a pixel of the target's centre after 1.5 s
  const end = play(newFollow(), tg).pop(), want = screen(tg[tg.length - 1]);
  assert.ok(Math.hypot(end[0] - want[0], end[1] - want[1]) <= 2.5);
});

test("shown at whole plate pixels; frame() targets keep the plate in view", () => {
  const F = framer(); let c = null;
  for (let i = 0; i < 200; i++) { const t = frame({ ...dims, plateW: 4800, plateH: 2560, scale: 2.2, focus: [2400 + i * 3, 1300] }); c = F.step(t, dt, T, dims, c); assert.equal(c.left, Math.round(c.left)); assert.equal(c.top, Math.round(c.top)); assert.ok(c.left >= 0 && c.top >= 0); }
});
