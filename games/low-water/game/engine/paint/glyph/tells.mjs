// The arena's ground telegraphs in type (ui/fightways.mjs drawTells is the painted one, on the fight
// canvas glyph mode hides): sweep an arc at the move's reach, slam a ring, pounce a dashed line ahead,
// shout rings going out, grab a ring under its target. Each is set as slope marks along its path in the
// view's hot colour, firming (regular to bold, dim to full) as the wind-up runs out. Original code.
//   drawArenaTells(W, toScreen, grid, out, atlas) -> cells set
const HOT = [255, 132, 72];
const slope = (dx, dy, cw, ch) => { const a = Math.atan2(dy * cw / ch, dx), t = ((a % Math.PI) + Math.PI) % Math.PI; return t < Math.PI / 8 || t > (7 * Math.PI) / 8 ? "-" : t < (3 * Math.PI) / 8 ? "\\" : t < (5 * Math.PI) / 8 ? "|" : "/"; };
function pathOf(F, m, W, u, toScreen) {
  const k = m.tell.kind, reach = Math.max(1, ...m.hits.map((h) => h.r[1]));
  const arc = (x, z, r, a0, a1) => { const p = []; for (let s = 0; s <= 28; s++) { const t = a0 + ((a1 - a0) * s) / 28, q = toScreen([x + Math.cos(t) * r, 0, z + Math.sin(t) * r]); if (q) p.push(q); } return p; };
  if (k === "sweep") { const h = m.hits[0], a = (d) => F.face + (d * Math.PI) / 180; return arc(F.x, F.z, reach, a(h.arc[0]), a(h.arc[1])); }
  if (k === "slam" || k === "shout") return arc(F.x, F.z, k === "shout" ? 0.8 + 2.5 * ((u * 3) % 1) : reach, 0, Math.PI * 2);
  if (k === "pounce") { const d = Math.max(reach, ...m.root.map(([a, b, v]) => ((b - a) * v) / 60)), p = []; for (let s = 0; s <= 16; s++) { if (s % 3 === 2) continue; const q = toScreen([F.x + Math.cos(F.face) * d * (s / 16), 0, F.z + Math.sin(F.face) * d * (s / 16)]); if (q) p.push(q); } return p; }
  if (k === "grab") { const T = W.lamb(); return T ? arc(T.x, T.z, 0.9 - 0.4 * u, 0, Math.PI * 2) : []; }
  return [];
}
export function drawArenaTells(W, toScreen, grid, out, atlas) {
  if (!W || !W.fighters || !toScreen) return 0;
  const { ox, oy, cw, ch, cols, rows } = grid; let n = 0;
  for (const F of W.fighters) {
    const m = F.act && W.moves && W.moves[F.act.id]; if (!m || !m.tell || F.out) continue;
    const f = F.act.f; if (f < m.tell.at[0] || f > m.tell.at[1] || !["sweep", "slam", "pounce", "shout", "grab"].includes(m.tell.kind)) continue;
    const u = Math.min(1, f / Math.max(1, m.startup)), pts = pathOf(F, m, W, u, toScreen).map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p));
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)], prev = pts[Math.max(0, i - 1)], x = Math.floor((a.x - ox) / cw), y = Math.floor((a.y - oy) / ch);
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const o = y * cols + x, g = atlas.index(slope(b.x - prev.x, b.y - prev.y, cw, ch));
      out.G[o] = u > 0.6 ? atlas.cut(g, "bold") : g; out.EM[o] = Math.round(110 + 130 * u); out.HOT[o] = 1; n++;
      for (let c = 0; c < 3; c++) { out.FG[o * 3 + c] = Math.round(HOT[c] * (0.55 + 0.45 * u)); out.BG[o * 3 + c] = Math.round(out.BG[o * 3 + c] * 0.5); }
    }
  }
  return n;
}
