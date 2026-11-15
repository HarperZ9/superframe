// The combat debug view (?debug=hits): each fighter's hurt volume (an upright cylinder: the ring at
// the feet and the ring at the head, combat/sim/hits.mjs) and, while a move is under way, its hit
// volumes (ring sectors round the attacker, drawn at the bottom of their height band): filled red on
// the frames they are live, outlined amber before and after. A label gives the move and its frame.
// For tuning tool hits against what the player sees; off in play.
import { hitsAt } from "../combat/sim/moves.mjs";

const ring = (F, r, y, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return [F.x + Math.cos(a) * r, y, F.z + Math.sin(a) * r]; });
function sector(F, h, y, n = 16) {
  const a0 = F.face + (h.arc[0] * Math.PI) / 180, a1 = F.face + (h.arc[1] * Math.PI) / 180, pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([F.x + Math.cos(a) * h.r[1], y, F.z + Math.sin(a) * h.r[1]]); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; pts.push([F.x + Math.cos(a) * h.r[0], y, F.z + Math.sin(a) * h.r[0]]); }
  return pts;
}
function path(g, toScreen, pts) {
  let first = true; g.beginPath();
  for (const p of pts) { const s = toScreen(p); if (!s) return false; if (first) g.moveTo(s.x, s.y); else g.lineTo(s.x, s.y); first = false; }
  return true;
}

export function drawHitDebug(g, W, toScreen) {
  g.save(); g.lineWidth = 1.5; g.font = "12px monospace";
  for (const F of W.fighters) {
    if (F.out) continue;
    const d = W.defs[F.id] || {}, r = d.radius || 0.3, ht = d.height || 1.75;
    g.strokeStyle = "rgba(90, 220, 255, 0.9)";
    if (path(g, toScreen, ring(F, r, 0))) g.stroke();
    if (path(g, toScreen, ring(F, r, ht))) g.stroke();
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { const p0 = [F.x + Math.cos(a) * r, 0, F.z + Math.sin(a) * r]; if (path(g, toScreen, [p0, [p0[0], ht, p0[2]]])) g.stroke(); }
    if (!F.act) continue;
    const m = W.moves[F.act.id]; if (!m || !m.hits) continue;
    const live = new Set(hitsAt(m, F.act.f));
    for (const h of m.hits) {
      if (!path(g, toScreen, sector(F, h, Math.max(0, h.y[0])))) continue;
      g.closePath();
      if (live.has(h)) { g.fillStyle = "rgba(255, 60, 40, 0.35)"; g.fill(); g.strokeStyle = "rgba(255, 60, 40, 1)"; }
      else g.strokeStyle = F.act.f < h.at[0] ? "rgba(255, 190, 60, 0.8)" : "rgba(255, 190, 60, 0.3)";
      g.stroke();
    }
    const s = toScreen([F.x, ht + 0.2, F.z]);
    if (s) { g.fillStyle = "rgba(255, 255, 255, 0.95)"; g.fillText(`${F.act.id} f${F.act.f}${live.size ? " LIVE" : ""}${F.act.hit && F.act.hit.length ? ` hit:${F.act.hit.join(",")}` : ""}`, s.x - 40, s.y); }
  }
  g.restore();
}
