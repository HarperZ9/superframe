// What a fight shows besides bodies (combat engineer's feel capture, 2026-10-17: "the player cannot see
// what hit them"): things in the air and the mark of each contact, drawn from combat's fxOf(W)
// (combat/anim/fx.mjs). In the plates' ink family (LOOK-UNIFIED: ink on a calm ground; the only
// light is a thrown lantern's own).
//   const fx = fightFx(); each frame: fx.read(W) before the bodies, fx.tellOf(id) for each body's drawer
//   args, then fx.draw(g, screen, dt) over them   screen([x, y, z]) -> { x, y, ppm } or null
import { fxOf } from "../combat/anim/fx.mjs";

const INK = "rgba(26,17,24,", PAPER = "rgba(233,227,212,", LIFE = 0.28; // a contact mark lasts 0.28 s

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
      for (const c of cur.contacts) { const by = W.fighters.find((F) => F.id === c.by); marks.push({ ...c, age: 0, seed: Math.random() * 6.28, dx: by ? by.x - c.x : 1, dz: by ? by.z - c.z : 0 }); }
      return cur;
    },
    draw(g, screen, dt = 1 / 60) {
      if (cur) thrown(g, cur.thrown, screen);
      for (const m of marks) { contact(g, m, screen); m.age += dt; }
      marks = marks.filter((m) => m.age < LIFE);
    },
    tellOf: (id) => tells.get(id) || null,
  };
}
