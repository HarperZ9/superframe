// The inner arena's marks on the arena page (combat/arena/draw.mjs calls these when W.inner is set; the room itself
// is staged by combat/arena/innerstage.mjs and innerfloor.mjs):
//   wallShadows(V, g)     Friday's tells: a boy's shoulders, in shadow on the wall the lamp lights, coming up as the
//                         blow winds up
//   floorMarks(V, g)      the hazards' marks; the thread in Nearest One, held or let go
//   anchor(V, out, W, H)  the one object in the base look, drawn after the dream palette, crisp and warm (07-SENSES 1)
//   innerHud(out, V, W, H) the lay and facing it as marks round the character, the card
// No figure, count or score is drawn (08-ARENA rule 8); the Accuser's spoken rows are the one exception, as his.
import { gray, feat } from "./forms.mjs";

const S = 30, BASE = { ink: "#2a1a14", paper: "#f2e4c4", warm: "#d89a52" };

export function wallShadows(V, g) {
  const W = V.W, wall = (W.field.arena.anchors.wall || [])[0]; if (!wall) return;
  // the lamp's light on the wall, where the shadow falls: a shadow reads only on a lit wall
  { const [x, y] = V.proj(wall[0], wall[1] + 0.4), k = W.field.lightAt(wall[0], wall[1] + 2.5, []), r = 2.4 * S, grd = g.createRadialGradient(x, y - 0.9 * S, 0, x, y - 0.9 * S, r);
    grd.addColorStop(0, gray(0.22 + 0.55 * k, 0.95)); grd.addColorStop(1, gray(0.22 + 0.55 * k, 0)); g.fillStyle = grd; g.fillRect(x - r, y - 0.9 * S - r, 2 * r, 2 * r); }
  for (const F of W.fighters) {
    if (!F.act) continue; const m = W.moves[F.act.id];
    if (!m.tell || m.tell.kind !== "shadow" || F.act.f < m.tell.at[0] || F.act.f > m.tell.at[1]) continue;
    const u = F.act.f / Math.max(1, m.startup), [x, y] = V.proj(wall[0], wall[1] + 0.4), base = y - 0.6 * S, up = u * 0.5 * S;
    // a boy's head and shoulders, the shoulders coming up round the ears as the hand goes up
    g.fillStyle = gray(0.02, 0.62 + 0.3 * u);
    g.beginPath(); g.ellipse(x, base - 1.1 * S, 0.28 * S, 0.32 * S, 0, 0, Math.PI * 2); g.fill();
    // the head of the shadow against the lit wall beside it
    feat(V, "shadow", { boxes: [[x - 0.14 * S, base - 1.3 * S, 0.28 * S, 0.36 * S]], vs: [[x - 0.85 * S, base - 1.5 * S, 0.3 * S, 0.3 * S], [x + 0.55 * S, base - 1.5 * S, 0.3 * S, 0.3 * S]] });
    g.beginPath(); g.moveTo(x - 0.75 * S, base); g.quadraticCurveTo(x - 0.6 * S, base - 0.7 * S - up, x - 0.22 * S, base - 0.75 * S - up); g.lineTo(x + 0.22 * S, base - 0.75 * S - up); g.quadraticCurveTo(x + 0.6 * S, base - 0.7 * S - up, x + 0.75 * S, base); g.closePath(); g.fill();
  }
}

export function floorMarks(V, g) {
  const W = V.W, I = W.inner;
  hazardMarks(V, g);
  if (I.flaw === "nearest" && I.thread && I.thread.length) {
    const L = W.lamb(), pts = [...I.thread, ...(I.laid ? [] : [[L.x, L.z]])];
    g.strokeStyle = gray(0.9, 0.85); g.lineWidth = 1; g.beginPath();
    pts.forEach(([x, z], i) => { const [px, py] = V.proj(x, z, I.laid ? 0 : 0.9); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
  }
}

// the anchor, after the palette: the base look, unchanged, inside the break
export function anchor(V, out, Wpx, Hpx) {
  const W = V.W, I = W.inner, a = I.anchor; if (!a) return;
  const k = Wpx / 640, at = (W.field.arena.anchors[a.key] || [])[0]; if (!at && a.draw !== "thread") return;
  const P = (x, z, y = 0) => { const [px, py] = V.proj(x, z, y); return [px * k, py * (Hpx / 360)]; };
  out.save(); out.lineWidth = 2; out.strokeStyle = BASE.ink; out.fillStyle = BASE.paper;
  if (a.draw === "clock") { const [x, y] = P(at[0], at[1], 1.8); out.beginPath(); out.arc(x, y, 13, 0, Math.PI * 2); out.fill(); out.stroke(); out.beginPath(); out.moveTo(x, y); out.lineTo(x, y - 10); out.moveTo(x, y); out.lineTo(x + 7, y); out.stroke(); }
  if (a.draw === "table") { const [x, y] = P(at[0], at[1], 0.8); out.fillStyle = BASE.warm; out.fillRect(x - 58, y - 8, 116, 14); out.strokeRect(x - 58, y - 8, 116, 14); }
  if (a.draw === "coat") { const [x, y] = P(at[0], at[1], 1.6); out.beginPath(); out.arc(x, y - 16, 2, 0, Math.PI * 2); out.stroke(); out.fillStyle = "#6b4a2c"; out.beginPath(); out.moveTo(x, y - 14); out.lineTo(x - 12, y + 18); out.lineTo(x + 12, y + 18); out.closePath(); out.fill(); out.stroke(); }
  if (a.draw === "door") { const [x, y] = P(at[0], at[1], 1.1); out.fillStyle = BASE.warm; out.fillRect(x - 10, y - 30, 20, 60); out.strokeRect(x - 10, y - 30, 20, 60); for (let i = 1; i < 4; i++) { out.beginPath(); out.moveTo(x - 10 + i * 5, y - 30); out.lineTo(x - 10 + i * 5, y + 30); out.stroke(); } }
  if (a.draw === "lamp") { const [x, y] = P(at[0], at[1], 1.2); out.fillStyle = BASE.warm; out.beginPath(); out.arc(x, y, 7, 0, Math.PI * 2); out.fill(); out.strokeRect(x - 2, y + 7, 4, 16); }
  if (a.draw === "thread") { const L = W.lamb(); if (!I.laid) { const [x, y] = P(L.x, L.z, 0.9); out.strokeStyle = "#3b5f8a"; out.beginPath(); out.moveTo(x - 6, y); out.lineTo(x + 6, y - 2); out.stroke(); } }
  out.restore();
}

export function innerHud(out, V, Wpx, Hpx) {
  const W = V.W, I = W.inner, L = W.lamb(), k = Wpx / 640, ky = Hpx / 360; if (!L) return;
  const [lx, ly] = V.proj(L.x, L.z); const x = lx * k, y = ly * ky;
  out.save(); out.font = "13px ui-monospace, Consolas, monospace";
  // the lay: a ring that closes round the character while guard and interact are held
  if (!I.laid && I.lay > 0) { out.strokeStyle = "rgba(239,228,210,0.85)"; out.lineWidth = 2; out.beginPath(); out.arc(x, y - 30, 16, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * I.lay) / 60); out.stroke(); }
  if (I.rub > 0) { out.strokeStyle = "rgba(239,228,210,0.85)"; out.lineWidth = 2; out.beginPath(); out.arc(x, y - 30, 12, 0, Math.PI * 2 * Math.min(1, I.rub / 150)); out.stroke(); }
  // the prop (innerprop.mjs): a dark post standing on the ground; smashed, a low stump until the next phase
  const P = I.prop;
  if (P) {
    const [tx, ty] = V.proj(P.at[0], P.at[1], 0), sx = tx * k, sy = ty * ky, h = P.up ? 34 : 8;
    out.fillStyle = "#1d1418"; out.fillRect(sx - 6, sy - h, 12, h);
    out.strokeStyle = "rgba(239,228,210,0.55)"; out.lineWidth = 1; out.strokeRect(sx - 6, sy - h, 12, h);
  }
  if (I.naming) { out.strokeStyle = "rgba(239,228,210,0.9)"; out.lineWidth = 2; out.beginPath(); out.arc(x, y - 30, 20, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * I.naming.t) / (I.nameHold || 90)); out.stroke(); }
  // the one card the Adversary's last movement leaves in his hand
  if (I.card) { out.fillStyle = "rgba(239,228,210,0.96)"; out.fillRect(Wpx / 2 - 120, Hpx / 2 - 24, 240, 48); out.fillStyle = "#1d1418"; out.textAlign = "center"; out.fillText(I.card, Wpx / 2, Hpx / 2 + 5); }
  out.restore();
}

function wrap(g, text, x, y, w, lh) {
  const words = text.split(" "); let line = "", n = 0;
  for (const wd of words) { if (g.measureText(line + wd).width > w && line) { g.fillText(line, x, y + n * lh); line = ""; n++; } line += `${wd} `; if (n > 1) break; }
  g.fillText(line, x, y + n * lh);
}

// the ground's tells (combat/arena/innerhaz.mjs): a pale outline where a mark will strike, filling as its lead runs
// out, then the struck ground solid for its active frames. Pale, never red, never a flash (WCAG 2.3.1).
function hazardMarks(V, g) {
  const W = V.W;
  for (const H of W.inner.hazards || []) {
    const u = Math.max(0, Math.min(1, (W.tick - H.laidAt) / Math.max(1, H.hitAt - H.laidAt))), live = W.tick >= H.hitAt;
    g.save(); g.strokeStyle = gray(0.92, 0.5 + 0.4 * u); g.fillStyle = gray(0.92, live ? 0.42 : 0.1 + 0.22 * u); g.lineWidth = 1.5;
    if (H.kind === "spot" || H.kind === "ring") {
      const [cx, cy] = V.proj(H.x, H.z), [ex] = V.proj(H.x + H.r, H.z), rx = Math.abs(ex - cx), ry = rx * 0.55;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      if (H.kind === "spot") { g.beginPath(); g.ellipse(cx, cy, rx * (live ? 1 : u), ry * (live ? 1 : u), 0, 0, Math.PI * 2); g.fill(); }
      else { const k = 1 + 1.4 / Math.max(0.5, H.r); g.beginPath(); g.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill("evenodd"); }
    }
    if (H.kind === "lane") {
      const b = W.field.bounds, half = H.w / 2;
      const pts = H.axis === "x" ? [[b.x0, H.z - half], [b.x1, H.z - half], [b.x1, H.z + half], [b.x0, H.z + half]] : [[H.x - half, b.z0], [H.x + half, b.z0], [H.x + half, b.z1], [H.x - half, b.z1]];
      g.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = V.proj(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.stroke(); g.fill();
    }
    g.restore();
  }
}
