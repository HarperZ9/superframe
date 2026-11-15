// What a fight offers besides fighting, shown in the fight (coordinator, 2026-10-21: the harness knew
// the exits were there; a player has to see them).
//   ways out    every exit of the arena is chalked on the ground: a dashed outline where it lies, an
//               arrow pointing out of the fight, and OUT in the middle of it; brighter while Lamb is in it and
//               steering (leaving takes half a second of that, sim/world.mjs)
//   talk exit   when one opens, a small speech mark over Lamb's head for two seconds (the tell), and
//               the offer card (ui/fightlayer.mjs) says what it costs in Composure and whether Lamb
//               has it yet ("hold your guard to find the words")
// Drawn on the fight's effects canvas, so painted and glyph modes both show them.
//   drawWays(g, W, toScreen, now)     offerNote(W) -> text | ""
const INK = "rgba(240, 232, 214, ", HOT = "rgba(255, 214, 150, ";

export function drawWays(g, W, toScreen, now = performance.now()) {
  const ex = (W.field && W.field.arena && W.field.arena.exits) || [], L = W.lamb && W.lamb();
  if (!ex.length || !L || W.result) return;
  const xs = ex.map(([x0, , x1]) => (x0 + x1) / 2), zs = ex.map(([, z0, , z1]) => (z0 + z1) / 2);
  const cx = W.field.bounds ? (W.field.bounds.x0 + W.field.bounds.x1) / 2 : xs.reduce((a, b) => a + b, 0) / xs.length;
  const cz = W.field.bounds ? (W.field.bounds.z0 + W.field.bounds.z1) / 2 : zs.reduce((a, b) => a + b, 0) / zs.length;
  g.save();
  for (const [x0, z0, x1, z1] of ex) {
    const inIt = L.x >= x0 && L.x <= x1 && L.z >= z0 && L.z <= z1, a = inIt ? 0.95 : 0.55 + 0.15 * Math.sin(now / 400);
    const corners = [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]].map(toScreen);
    if (corners.some((c) => !c)) continue;
    g.strokeStyle = (inIt ? HOT : INK) + a + ")"; g.lineWidth = inIt ? 3 : 2; g.setLineDash([7, 6]);
    g.beginPath(); corners.forEach((c, i) => (i ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y))); g.closePath(); g.stroke();
    // an arrow from the middle of the exit, outward from the fight's middle
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, dx = mx - cx, dz = mz - cz, d = Math.hypot(dx, dz) || 1;
    const p0 = toScreen([mx - (dx / d) * 0.4, 0, mz - (dz / d) * 0.4]), p1 = toScreen([mx + (dx / d) * 0.6, 0, mz + (dz / d) * 0.6]);
    if (p0 && p1) {
      g.setLineDash([]); g.lineWidth = 3; g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x), h = 9;
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p1.x - h * Math.cos(ang - 0.5), p1.y - h * Math.sin(ang - 0.5)); g.moveTo(p1.x, p1.y); g.lineTo(p1.x - h * Math.cos(ang + 0.5), p1.y - h * Math.sin(ang + 0.5)); g.stroke();
      // the word OUT is a page label (wayLabels), so glyph mode shows it too
    }
  }
  g.restore();
}

// The tell when a talk exit opens: a speech mark over Lamb for two seconds.
export function drawTalkTell(g, W, toScreen, since, now = performance.now()) {
  if (since == null || now - since > 2000 || !W.talk || W.result) return;
  const L = W.lamb(); if (!L) return;
  const p = toScreen([L.x, 2.15, L.z]); if (!p) return;
  const k = 1 - (now - since) / 2000, r = 11;
  g.save(); g.globalAlpha = Math.min(1, 0.4 + k);
  g.fillStyle = "rgba(240, 232, 214, 0.95)"; g.strokeStyle = "rgba(30, 24, 22, 0.9)"; g.lineWidth = 2;
  g.beginPath(); g.ellipse(p.x, p.y - 8, r * 1.4, r, 0, 0, Math.PI * 2); g.moveTo(p.x - 4, p.y + 1); g.lineTo(p.x - 9, p.y + 9); g.lineTo(p.x + 3, p.y + 2); g.fill(); g.stroke();
  g.fillStyle = "rgba(30, 24, 22, 0.95)"; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(p.x + i * 6, p.y - 8, 1.8, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

// What the offer card says under the words: the Composure they cost, and whether Lamb has it.
export function offerNote(W, costOf) {
  const L = W.lamb && W.lamb(); if (!L || !W.talk) return "";
  const cost = costOf(W, L), have = L.composure ?? 0;
  if (cost <= 0) return "Free: say it.";
  return have >= cost ? `Costs ${fmt(cost)} Composure. You have ${fmt(have)}.` : `Costs ${fmt(cost)} Composure; you have ${fmt(have)}. Hold your guard to find the words.`;
}
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// The same marks as labels on the page, for glyph mode (which draws page panels, not this canvas):
// one per way out where its arrow points, and the tell over Lamb. [{ x, y, text, hot }]
export function wayLabels(W, toScreen, talkSince, now = performance.now()) {
  const ex = (W.field && W.field.arena && W.field.arena.exits) || [], L = W.lamb && W.lamb(), out = [];
  if (!L || W.result) return out;
  const b = W.field.bounds, cx = b ? (b.x0 + b.x1) / 2 : 0, cz = b ? (b.z0 + b.z1) / 2 : 0;
  for (const [x0, z0, x1, z1] of ex) {
    // the word sits in the middle of the chalked box, where Lamb has to stand (2026-10-21 UX walk: placed at
    // the arrow's tip, beyond the box, it led a new player past the way out and off the quay's edge)
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, p = toScreen([mx, 0, mz]);
    const inIt = L.x >= x0 && L.x <= x1 && L.z >= z0 && L.z <= z1;
    if (p) out.push({ x: p.x, y: p.y, text: inIt ? "OUT, keep going" : "OUT", hot: inIt });
  }
  if (talkSince != null && now - talkSince < 2000 && W.talk) { const p = toScreen([L.x, 2.2, L.z]); if (p) out.push({ x: p.x, y: p.y - 10, text: "...", hot: true, tell: true }); }
  return out;
}

// Each way out's box on the screen, as [x0, y0, x1, y1] in the layer's pixels (for keeping the paper
// off it); a box with a corner off the camera is left out.
export function exitRects(W, toScreen) {
  const ex = (W.field && W.field.arena && W.field.arena.exits) || [], out = [];
  for (const [x0, z0, x1, z1] of ex) {
    const cs = [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]].map(toScreen);
    if (cs.some((c) => !c)) continue;
    out.push([Math.min(...cs.map((c) => c.x)), Math.min(...cs.map((c) => c.y)), Math.max(...cs.map((c) => c.x)), Math.max(...cs.map((c) => c.y))]);
  }
  return out;
}
// The way out nearest Lamb, as ground points the camera frames with the fighters (so the paper never
// sits over the one a player is most likely to make for).
export function nearestExitPoints(W) {
  const ex = (W.field && W.field.arena && W.field.arena.exits) || [], L = W.lamb && W.lamb(); if (!ex.length || !L) return [];
  const [x0, z0, x1, z1] = [...ex].sort((a, b) => Math.hypot((a[0] + a[2]) / 2 - L.x, (a[1] + a[3]) / 2 - L.z) - Math.hypot((b[0] + b[2]) / 2 - L.x, (b[1] + b[3]) / 2 - L.z))[0];
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
}
// The point of the nearest way out closest to Lamb, when it lies within reach metres of Lamb (engine PROGRESS 37):
// the camera frames it with the fighters. Framing the whole box let a long way out (the quay's steps down to the
// water) pull the view back until the fighters sat small in one corner over open water; the near point keeps the
// way a player would make for in view and moves smoothly as Lamb does.
export const EXIT_REACH = 6;
export function nearestExitPoint(W, reach = EXIT_REACH) {
  const ex = (W.field && W.field.arena && W.field.arena.exits) || [], L = W.lamb && W.lamb(); if (!ex.length || !L) return null;
  let best = null, bd = Infinity;
  for (const [x0, z0, x1, z1] of ex) { const x = Math.max(Math.min(x0, x1), Math.min(Math.max(x0, x1), L.x)), z = Math.max(Math.min(z0, z1), Math.min(Math.max(z0, z1), L.z)), d = Math.hypot(x - L.x, z - L.z); if (d < bd) { bd = d; best = [x, z]; } }
  return bd <= reach ? best : null;
}
export const overlaps = (a, b, pad = 0) => a[0] < b[2] + pad && a[2] > b[0] - pad && a[1] < b[3] + pad && a[3] > b[1] - pad;
// How much of a way out a panel hides: the share of the box's on-screen part under the panel, or 0 for a
// box mostly off the screen (a player cannot make for it from here anyway). tools/layoutcheck.mjs uses
// the same measure, and COVER as its limit.
export const COVER = 0.2;
const area = (r) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
const cut = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
export function coverShare(panel, box, view) {
  const on = cut(box, [0, 0, view[0], view[1]]), seen = area(on);
  if (!area(box) || seen < 0.5 * area(box)) return 0;
  return area(cut(panel, on)) / seen;
}

// A home for the fight's status panel (Standing, Breath, Composure) that never sits over a way out
// (2026-10-21: over the station's door it was faded, and a faded Standing is no use). Four corners: bottom
// left (its own), top left under the HUD, top right under the meters, bottom right above the keys. The
// panel stays where it is while that spot is clear; otherwise the first clear corner, or the one hiding
// least. size [w, h], view [W, H]; boxes: the ways out; avoid: other paper; tops: { left, right, keysTop }.
export function dockSpot(size, view, { boxes = [], avoid = [], tops = {}, current = "bl", pad = 28 } = {}) {
  const [w, h] = size, [Wd, Hd] = view;
  const at = { bl: [pad, Hd - pad - h], tl: [pad, tops.left ?? pad], tr: [Wd - pad - w, tops.right ?? pad], br: [Wd - pad - w, (tops.keysTop ?? Hd - pad) - h] };
  const rectOf = (k) => [at[k][0], at[k][1], at[k][0] + w, at[k][1] + h];
  const cost = (k) => { const r = rectOf(k); if (r[1] < 0 || r[3] > Hd) return Infinity; return boxes.reduce((s, b) => s + coverShare(r, b, view), 0) + (avoid.some((a) => overlaps(r, a)) ? 1 : 0); };
  if (cost(current) === 0) return { spot: current, rect: rectOf(current) };
  const best = ["bl", "tl", "tr", "br"].map((k) => [k, cost(k)]).sort((a, b) => a[1] - b[1])[0][0];
  return { spot: best, rect: rectOf(best) };
}

// The HUD (clock, tide, place) likewise: its own corner top left, else top centre, else top right under
// the meters, whichever hides no way out (2026-10-21: over the quay's top way out in Act 1).
export function hudSpot(size, view, { boxes = [], avoid = [], right = 28, current = "tl", pad = 28 } = {}) {
  const [w, h] = size, [Wd] = view;
  const at = { tl: [pad, pad], tc: [Math.round((Wd - w) / 2), pad], tr: [Wd - pad - w, right] };
  const rectOf = (k) => [at[k][0], at[k][1], at[k][0] + w, at[k][1] + h];
  const cost = (k) => boxes.reduce((s, b) => s + coverShare(rectOf(k), b, view), 0) + (avoid.some((a) => overlaps(rectOf(k), a)) ? 1 : 0);
  if (cost(current) === 0) return { spot: current, rect: rectOf(current) };
  const best = ["tl", "tc", "tr"].map((k) => [k, cost(k)]).sort((a, b) => a[1] - b[1])[0][0];
  return { spot: best, rect: rectOf(best) };
}

// The arena's telegraphs on the ground, in the shell's fights (painted and glyph both draw this canvas):
// sweep and slam, the move's reach as an arc or a ring that firms as the wind-up runs out; pounce and charge,
// a dashed line ahead; shout, rings going out; grab, a ring under the one it is meant for. The figure layer
// keeps its own swing, throw and grab tells on the body (combat/data/archetypes.mjs, bosses.mjs).
export function drawTells(g, W, toScreen) {
  const arc = (x, z, r, a0, a1) => { const pts = []; for (let s = 0; s <= 20; s++) { const t = a0 + ((a1 - a0) * s) / 20, p = toScreen([x + Math.cos(t) * r, 0, z + Math.sin(t) * r]); if (p) pts.push(p); } return pts; };
  g.save();
  for (const F of W.fighters) {
    const m = F.act && W.moves[F.act.id]; if (!m || !m.tell || F.out) continue;
    const f = F.act.f, k = m.tell.kind; if (f < m.tell.at[0] || f > m.tell.at[1] || !["sweep", "slam", "pounce", "shout", "grab"].includes(k)) continue;
    const u = Math.min(1, f / Math.max(1, m.startup)), reach = Math.max(1, ...m.hits.map((h) => h.r[1]));
    g.strokeStyle = `rgba(255, 214, 150, ${0.35 + 0.55 * u})`; g.lineWidth = 2 + 2 * u; g.setLineDash(k === "pounce" ? [8, 6] : []);
    let pts = [];
    if (k === "sweep") { const h = m.hits[0], a = (d) => F.face + (d * Math.PI) / 180; pts = arc(F.x, F.z, reach, a(h.arc[0]), a(h.arc[1])); }
    else if (k === "slam" || k === "shout") pts = arc(F.x, F.z, k === "shout" ? 0.8 + 2.5 * ((u * 3) % 1) : reach, 0, Math.PI * 2);
    else if (k === "pounce") { const d = Math.max(reach, ...m.root.map(([a, b, v]) => ((b - a) * v) / 60)); pts = [toScreen([F.x, 0, F.z]), toScreen([F.x + Math.cos(F.face) * d, 0, F.z + Math.sin(F.face) * d])].filter(Boolean); }
    else if (k === "grab") { const T = W.lamb(); if (T) pts = arc(T.x, T.z, 0.9 - 0.4 * u, 0, Math.PI * 2); }
    if (pts.length > 1) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
  }
  g.restore();
}
