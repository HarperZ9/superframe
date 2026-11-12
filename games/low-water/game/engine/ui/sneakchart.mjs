// Drawing a sneak scene (world/sneak.mjs view()) on the Tide Run's paper chart. Each watcher
// shows its cone, its state as a word and a mark (none, ?, ??, !), and how sure it is as a
// row of notches; where it last heard or saw Lamb is a cross. Hiding spots are hatched and
// labelled "cover". Nothing depends on colour alone.
import { C, fit, light, goal, you, timeMark, label } from "./chart.mjs";

const MARK = { unaware: "", suspicious: "?", searching: "??", seen: "!" };

function bounds(v) {
  const xs = [v.x, v.goal.x], zs = [v.z, v.goal.z];
  for (const r of v.rects) { xs.push(r[0], r[2]); zs.push(r[1], r[3]); }
  for (const w of v.watchers) { xs.push(w.x - w.cone[0], w.x + w.cone[0]); zs.push(w.z - w.cone[0], w.z + w.cone[0]); }
  return { x0: Math.min(...xs) - 1, x1: Math.max(...xs) + 1, z0: Math.min(...zs) - 1, z1: Math.max(...zs) + 1 };
}

export function drawSneak(canvas, v, telegraph = "") {
  const { g, W, H } = fit(canvas);
  if (!W || !H) return;
  const b = bounds(v), top = 54, pad = 28;
  const s = Math.min((W - pad * 2) / (b.x1 - b.x0), (H - top - pad - 40) / (b.z1 - b.z0));
  const ox = (W - (b.x1 - b.x0) * s) / 2, oz = top + 40 + (H - top - pad - 40 - (b.z1 - b.z0) * s) / 2;
  const P = (x, z) => [ox + (x - b.x0) * s, oz + (z - b.z0) * s];
  g.fillStyle = C.night; g.fillRect(0, 0, W, H);
  for (const r of v.rects) { const [ax, az] = P(Math.min(r[0], r[2]), Math.min(r[1], r[3])); g.fillStyle = "rgba(233,227,212,0.82)"; g.fillRect(ax, az, Math.abs(r[2] - r[0]) * s, Math.abs(r[3] - r[1]) * s); }
  for (const l of v.lights) light(g, P, s, l);
  for (const h of v.hides) cover(g, P, s, h);
  for (const w of v.watchers) watcher(g, P, s, w, v);
  goal(g, P, s, v.goal);
  you(g, P, s, v);
  if (v.crouch) label(g, ...P(v.x, v.z).map((n, i) => n + (i ? 20 : 14)), "crouched", C.ink2);
  timeMark(g, W, v);
  strip(g, W, telegraph);
}

function cover(g, P, s, h) {
  const [x, z] = P(h.x, h.z), r = h.r * s;
  g.save(); g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.clip();
  g.strokeStyle = C.ink2; g.lineWidth = 1; for (let k = -r; k < r; k += 5) { g.beginPath(); g.moveTo(x + k, z - r); g.lineTo(x + k + r, z + r); g.stroke(); }
  g.restore();
  g.strokeStyle = C.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.stroke();
  label(g, x - r, z + r + 14, `cover ${Math.round(h.cover * 100)}%`, C.ink);
}

function watcher(g, P, s, w, v0) {
  const [x, z] = P(w.x, w.z), R = w.cone[0] * s, half = (w.cone[1] * Math.PI) / 180;
  const a = Math.atan2(Math.cos(w.face), Math.sin(w.face)); // world forward (sin, cos) in chart axes
  const shade = { unaware: 0.1, suspicious: 0.22, searching: 0.34, seen: 0.5 }[w.state];
  g.beginPath(); g.moveTo(x, z); g.arc(x, z, R, a - half, a + half); g.closePath();
  g.fillStyle = `rgba(29,20,24,${shade})`; g.fill();
  g.setLineDash(w.state === "unaware" ? [5, 3] : []); g.strokeStyle = w.state === "seen" ? C.hot : C.ink; g.lineWidth = w.state === "unaware" ? 1.5 : 2.5; g.stroke(); g.setLineDash([]);
  g.fillStyle = C.ink; g.fillRect(x - 6, z - 6, 12, 12);
  const word = `${w.name}: ${w.state}${MARK[w.state] ? ` ${MARK[w.state]}` : ""}`;
  g.fillStyle = "rgba(233,227,212,0.92)"; g.fillRect(x + 9, z - 26, Math.max(110, word.length * 7.2), 30);
  label(g, x + 13, z - 12, word, w.state === "seen" ? C.hot : C.ink);
  for (let k = 0; k < 10; k++) { g.strokeStyle = C.ink; g.lineWidth = 1; g.strokeRect(x + 13 + k * 8, z - 6, 6, 5); if (w.a * 10 > k) { g.fillStyle = C.ink; g.fillRect(x + 13 + k * 8, z - 6, 6, 5); } }
  if (w.lastKnown && w.state !== "unaware") { const [lx, lz] = P(w.lastKnown[0], w.lastKnown[1]); g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(lx - 5, lz - 5); g.lineTo(lx + 5, lz + 5); g.moveTo(lx + 5, lz - 5); g.lineTo(lx - 5, lz + 5); g.stroke(); if (Math.hypot(w.lastKnown[0] - v0.x, w.lastKnown[1] - v0.z) > 1) label(g, lx + 8, lz + 4, "last known", C.ink2); }
}

// The latest thing a watcher said, under the time line: the telegraph.
function strip(g, W, text) {
  g.fillStyle = "rgba(233,227,212,0.96)"; g.fillRect(0, 46, W, 36);
  label(g, 28, 69, text ? text : "Nobody has noticed anything.", text ? C.ink : C.ink2);
}
