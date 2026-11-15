// What a fight shows besides bodies (combat engineer's feel capture, 2026-10-17: "the player cannot see
// what hit them"): things in the air and the mark of each contact, drawn from combat's fxOf(W)
// (combat/anim/fx.mjs). In the plates' ink family (LOOK-UNIFIED: ink on a calm ground; the only
// light is a thrown lantern's own).
//   const fx = fightFx(); each frame: fx.read(W) before the bodies, fx.tellOf(id) for each body's drawer
//   args, then fx.draw(g, screen, dt) over them   screen([x, y, z]) -> { x, y, ppm } or null
import { fxOf } from "../combat/anim/fx.mjs";

const INK = "rgba(26,17,24,", PAPER = "rgba(233,227,212,", LIFE = 0.28; // a contact mark lasts 0.28 s

// A hit's mark by the striker's tool class (2026-10-21, so a viewer tells the tool from the impact with the
// sound off; with the striker's recoil in characters/runtime/feel.mjs). All in the plates' ink: a blade
// cuts one long tapered slash; a stick, cosh or case sweeps one light arc; a
// crowbar lays a short thick bar bent at a right angle; a hook or pole drives a long line through the body
// that curls into a hook; a hammer bursts nine heavy strokes and rings the ground; a fist is three dots.
const MARK = {
  // a blade: one long tapered cut across the line of the blow, sharp at both ends (the blind test of
  // 2026-10-21 read two parallel lines as a stick)
  short(g, p, R, m) { const a = Math.atan2(m.dz || 0, m.dx || 1) + Math.PI / 2 + 0.35, c = Math.cos(a), s = Math.sin(a), L = R * 1.4, w = Math.max(2, p.ppm * 0.05);
    for (const [col, k] of [[`${PAPER}0.9)`, 1.8], [`${INK}0.95)`, 1]]) { g.fillStyle = col; g.beginPath(); g.moveTo(p.x - c * L, p.y - s * L); g.lineTo(p.x - s * w * k, p.y + c * w * k); g.lineTo(p.x + c * L, p.y + s * L); g.lineTo(p.x + s * w * k, p.y - c * w * k); g.closePath(); g.fill(); } },
  // a stick, cosh or case: one light swept arc on the side the blow came from (the third blind test read an arc as a swung club)
  light(g, p, R, m) { const a = Math.atan2(m.dz || 0, m.dx || 1); for (const [col, w] of [[`${PAPER}0.9)`, 2], [`${INK}0.95)`, 1]]) { g.strokeStyle = col; g.lineWidth = Math.max(2 * w, p.ppm * 0.028 * w); g.beginPath(); g.arc(p.x, p.y, R * 0.85, a - 1.2, a + 1.2); g.stroke(); } },
  shield(g, p, R, m) { MARK.light(g, p, R, m); },
  // a crowbar: a short thick bar across the body bent at one end at a right angle, the gooseneck (blind test 4 read a bent line as a crowbar)
  bar(g, p, R, m) { const a = Math.atan2(m.dz || 0, m.dx || 1) + Math.PI / 2, c = Math.cos(a), s = Math.sin(a), L = R * 0.9, ex = p.x + c * L, ey = p.y + s * L, n = [-s, c];
    for (const [col, w] of [[`${PAPER}0.9)`, 2], [`${INK}0.95)`, 1]]) { g.strokeStyle = col; g.lineCap = "round"; g.lineJoin = "round"; g.lineWidth = Math.max(4 * w, p.ppm * 0.07 * w);
      g.beginPath(); g.moveTo(p.x - c * L, p.y - s * L); g.lineTo(ex, ey); g.lineTo(ex + n[0] * R * 0.45, ey + n[1] * R * 0.45); g.stroke(); } },
  // a boathook or pole: a long thin line driven through the body along the blow, ending in a round curled hook (a J)
  long(g, p, R, m) { const a = Math.atan2(m.dz || 0, m.dx || 1) + Math.PI, c = Math.cos(a), s = Math.sin(a), bx = p.x + c * R * 1.3, by = p.y + s * R * 1.3, r = R * 0.28;
    for (const [col, w] of [[`${PAPER}0.85)`, 2.4], [`${INK}0.95)`, 1.3]]) { g.strokeStyle = col; g.lineCap = "round"; g.lineWidth = Math.max(w, p.ppm * 0.022 * w);
      g.beginPath(); g.moveTo(p.x - c * R * 0.7, p.y - s * R * 0.7); g.lineTo(bx, by); g.arc(bx - s * r, by + c * r, r, a - Math.PI / 2, a + Math.PI * 0.9); g.stroke(); } },
  // a hammer: a heavy burst, nine wedges from the point, paper under ink so it reads on a dark coat, and a ring on the ground
  heavy(g, p, R, m) { const r = Math.min(R * 1.2, p.ppm * 0.7);
    for (const [col, w] of [[`${PAPER}0.85)`, 2], [`${INK}0.95)`, 1]]) { g.strokeStyle = col; g.lineWidth = Math.max(3 * w, p.ppm * 0.045 * w); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + m.seed; g.beginPath(); g.moveTo(p.x + Math.cos(a) * r * 0.4, p.y + Math.sin(a) * r * 0.4); g.lineTo(p.x + Math.cos(a) * r * 1.1, p.y + Math.sin(a) * r * 1.1); g.stroke(); } }
    g.strokeStyle = `${PAPER}0.7)`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(p.x, p.y + p.ppm * 1.05, r * 1.4, r * 0.4, 0, 0, Math.PI * 2); g.stroke(); },
  unarmed(g, p, R) { g.fillStyle = `${INK}0.95)`; for (const [dx, dy] of [[-0.3, 0], [0, -0.25], [0.3, 0]]) { g.beginPath(); g.arc(p.x + dx * R, p.y + dy * R, Math.max(1.5, R * 0.11), 0, Math.PI * 2); g.fill(); } },
};
export const MARK_CLASSES = Object.keys(MARK);

export function fightFx() {
  let tells = new Map(), marks = [], cur = null; const trails = new Map(); // a thrown thing's last positions (its arc so far)
  // a stone, mud or rope: a small dark mark and a short trail behind it; a lantern: its light
  function thrown(g, T, screen) {
    const live = new Set();
    for (const t of T) {
      live.add(t.n); const hist = trails.get(t.n) || []; hist.push([t.x, t.y, t.z]); if (hist.length > 14) hist.shift(); trails.set(t.n, hist);
      const p = screen([t.x, t.y, t.z]); if (!p) continue;
      // big enough to see in its 0.3 s of flight (combat engineer's capture: 10 px at 1080p was too small)
      const r = Math.max(5, p.ppm * (t.use === "lantern" ? 0.14 : t.use === "rope" ? 0.08 : 0.11));
      // the arc it has flown, as a fading ink line, so the eye finds where it came from
      g.lineCap = "round";
      for (let i = 1; i < hist.length; i++) { const a = screen(hist[i - 1]), b = screen(hist[i]); if (!a || !b) continue; g.strokeStyle = `${INK}${(0.15 + 0.6 * (i / hist.length)).toFixed(2)})`; g.lineWidth = Math.max(1.5, r * 0.7 * (i / hist.length)); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }

      if (t.use === "lantern") { const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6); gr.addColorStop(0, "rgba(255,196,120,0.55)"); gr.addColorStop(1, "rgba(255,196,120,0)"); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r * 6, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = t.use === "mud" ? `${INK}0.75)` : `${INK}0.95)`; g.strokeStyle = `${PAPER}0.8)`; g.lineWidth = 1;
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill(); g.stroke();
      // where it will land is not drawn: the wind-up is the warning (48 frames)
    }
    for (const n of [...trails.keys()]) if (!live.has(n)) trails.delete(n);
  }
  // a contact's mark at the struck body, sized by power (a catch the strongest), fading over LIFE
  function contact(g, m, screen) {
    const p = screen([m.x, 1.1, m.z]); if (!p) return;
    const k = 1 - m.age / LIFE, R = p.ppm * (0.18 + 0.4 * m.power) * (m.kind === "catch" ? 1.3 : 1) * (1 + (1 - k) * 0.35);
    g.save(); g.globalAlpha = Math.max(0, k);
    g.lineCap = "round";
    if (m.kind === "hit" && MARK[m.cls]) { MARK[m.cls](g, p, R, m); g.restore(); return; }
    if (m.kind === "hit" || m.kind === "guardbreak") { // ink strokes out from the point; a guard break leaves a gap
      const n = m.kind === "hit" ? 7 : 5; g.strokeStyle = `${INK}0.95)`; g.lineWidth = Math.max(1.5, p.ppm * 0.03);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + m.seed; g.beginPath(); g.moveTo(p.x + Math.cos(a) * R * 0.45, p.y + Math.sin(a) * R * 0.45); g.lineTo(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); g.stroke(); }
      g.strokeStyle = `${PAPER}0.9)`; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, R * 0.35, m.kind === "guardbreak" ? 0.5 : 0, m.kind === "guardbreak" ? Math.PI * 1.6 : Math.PI * 2); g.stroke();
    } else if (m.kind === "catch") { // a full paper ring with an ink rim: the strongest mark
      g.strokeStyle = `${INK}0.9)`; g.lineWidth = Math.max(3, p.ppm * 0.06); g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = `${PAPER}0.95)`; g.lineWidth = Math.max(1.5, p.ppm * 0.03); g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.stroke();
    } else if (m.kind === "block") { // a short arc on the side it came from
      const a = Math.atan2(m.dz || 0, m.dx || 1); g.strokeStyle = `${PAPER}0.9)`; g.lineWidth = Math.max(2, p.ppm * 0.04); g.beginPath(); g.arc(p.x, p.y, R, a - 0.7, a + 0.7); g.stroke();
    } else if (m.kind === "evade") { // two faint dashes
      g.strokeStyle = `${PAPER}0.6)`; g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    g.restore();
  }
  return {
    // once per animation frame: read combat's fx, draw what is in the air and the live contact marks
    read(W) {
      cur = fxOf(W);
      tells = new Map(cur.tells.map((t) => [t.id, t]));
      for (const c of cur.contacts) { const key = `${c.kind}|${c.id}|${c.by}|${c.t}`; if (marks.some((m) => m.key === key)) continue; const by = W.fighters.find((F) => F.id === c.by), d = by && W.defs && W.defs[by.id]; marks.push({ key, ...c, age: 0, seed: Math.random() * 6.28, dx: by ? by.x - c.x : 1, dz: by ? by.z - c.z : 0, cls: (d && d.tool && d.tool.cls) || null }); }
      return cur;
    },
    draw(g, screen, dt = 1 / 60) {
      if (cur) thrown(g, cur.thrown, screen);
      for (const m of marks) { contact(g, m, screen); m.age += globalThis.__lwFxHold ? 0 : dt; }   // __lwFxHold: captures stepped by hand keep the marks
      marks = marks.filter((m) => m.age < LIFE);
    },
    tellOf: (id) => tells.get(id) || null,
  };
}
