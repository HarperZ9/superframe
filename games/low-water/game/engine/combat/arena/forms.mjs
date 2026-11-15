// The inner bosses' forms on the arena page, until the character lead's production forms exist. Each form is drawn
// for its silhouette at game scale first (the grey test: design/critic/07-INFERNO.md section 3), in values (ink to
// paper) into the arena's 640 x 360 buffer, on the bodies' own layer (combat/arena/innertone.mjs puts the found
// edge and the ink line on it). The phase shows by shape, never a label: the morph is the look change
// (design/sensory/03-SURREAL.md rule 9). No boss is taller than the Brack kitchen's ceiling except Saturn, which is
// the ceiling (inferno/06-SYSTEMS.md, "Intensity without volume"); the scale of the place is in the building.
//   drawForm(g, V, F, pose, light)   formGround(V, g)  (what a form lays on the floor: the eye, the twelfth chair)
// A form names the parts that must read (V.features: Saturn's eyes, the arm, the horns, a limb's mark), so the
// silhouette check (combat/tools/silhouette.mjs) can measure them in the finished frame.
import { gray, hash } from "./innerstage.mjs";
import { FORMS2 } from "./forms2.mjs";
import { FORMS3 } from "./forms3.mjs";
import { FORMS4 } from "./forms4.mjs";
import { FORMS5 } from "./forms5.mjs";

const S = 30;
export { gray };
export const feat = (V, name, shape) => (V.features ||= []).push({ name, ...shape });
export const tip = (V, F, x, y) => { (V.tips ||= {})[F.id] = [x, y]; };
export const limb = (g, pts, w0, w1, v) => { for (let k = 0; k < pts.length - 1; k++) { const u = k / Math.max(1, pts.length - 2); g.strokeStyle = gray(v); g.lineCap = "round"; g.lineWidth = w0 + (w1 - w0) * u; g.beginPath(); g.moveTo(...pts[k]); g.lineTo(...pts[k + 1]); g.stroke(); } g.lineCap = "butt"; };
export const poly = (g, pts, v, a = 1) => { g.fillStyle = gray(v, a); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
export const oval = (g, x, y, rx, ry, v, a = 1) => { g.fillStyle = gray(v, a); g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill(); };

export function drawForm(g, V, F, pose, light) {
  const W = V.W, d = W.defs[F.id], I = W.inner || {}, [bx, by] = V.proj(F.x, F.z), H = d.height * S * 0.9, w = d.radius * S * 1.3;
  const ink = 0.06 * (0.6 + 0.8 * light), fx = Math.cos(F.face), fz = Math.sin(F.face);
  const ph = (F.mem && F.mem.phase) || 0, act = pose.phase === "startup" || pose.phase === "active" ? (pose.phase === "active" ? 1 : F.act.f / Math.max(1, W.moves[F.act.id].startup)) : 0;
  if (F.out && d.fused) return; // fused into the heap it came from (Under the Goats' sacks at the dragon)
  if (F.out || F.fallen) { fallen(g, bx, by, w, ink, P0(F)); return; }
  const P = { g, V, F, d, I, bx, by, H, w, ink, fx, fz, ph, act, light, s: fx >= 0 ? 1 : -1 };
  (FORMS[d.form] || FORMS2[d.form] || FORMS3[d.form] || FORMS4[d.form] || FORMS5[d.form] || FORMS.coat)(P);
}

const P0 = (F) => (Math.cos(F.face) >= 0 ? 1 : -1);
// a form that has gone down lies where it fell: a coat flat on the floor, its collar pale, never a black hole
function fallen(g, bx, by, w, ink, s) {
  poly(g, [[bx - s * w * 1.6, by - 3], [bx + s * w * 1.2, by - 7], [bx + s * w * 1.5, by + 2], [bx - s * w * 1.3, by + 4]], Math.max(0.08, ink));
  g.strokeStyle = gray(0.45); g.lineWidth = 1; g.beginPath(); g.moveTo(bx + s * w * 1.0, by - 6); g.lineTo(bx + s * w * 1.3, by - 1); g.stroke();
}

const FORMS = {
  // Steady Hand (PRUDENCE) is drawn in combat/arena/forms5.mjs since the traits pass (2026-10-23): the scale's beam for an arm
  // an empty coat: no head, the collar open on nothing; it sits while the coats keep still
  coat(P) {
    const { g, V, F, I, bx, by, H, w, ink, light } = P, sit = I.handsStill && Math.hypot(F.vx, F.vz) < 0.2, h = sit ? H * 0.7 : H, sh = by - h * 0.92;
    if (sit) { g.fillStyle = gray(0.1); g.fillRect(bx - w * 0.95, sh - h * 0.3, 3, h * 1.25); g.fillRect(bx + w * 0.95 - 3, sh - h * 0.3, 3, h * 1.25); g.fillRect(bx - w * 0.95, sh - h * 0.3, w * 1.9, 3); }
    poly(g, [[bx - w * 0.95, sh + 2], [bx + w * 0.95, sh + 2], [bx + w * 1.2, by - h * 0.06], [bx - w * 1.2, by - h * 0.06]], ink);
    poly(g, [[bx - w * 0.6, sh - 3], [bx + w * 0.6, sh - 3], [bx + w * 1.0, sh + 3], [bx - w * 1.0, sh + 3]], ink);
    for (const s of [-1, 1]) poly(g, [[bx + s * w * 1.0, sh + 1], [bx + s * w * 1.28, sh + 4], [bx + s * w * 1.36, by - h * 0.32], [bx + s * w * 1.08, by - h * 0.3]], ink * 0.9);
    poly(g, [[bx - w * 0.42, sh - 3], [bx + w * 0.42, sh - 3], [bx, sh + h * 0.22]], 0.0);
    g.strokeStyle = gray(0.5 + 0.35 * light); g.lineWidth = 2; g.beginPath(); g.moveTo(bx - w * 0.45, sh - 3); g.lineTo(bx, sh + h * 0.22); g.lineTo(bx + w * 0.45, sh - 3); g.stroke();
    feat(V, "collar", { seg: [bx - w * 0.45, sh - 3, bx, sh + h * 0.22], w: 2 }); feat(V, "collar", { seg: [bx + w * 0.45, sh - 3, bx, sh + h * 0.22], w: 2 });
    tip(V, F, bx + P.s * w * 1.3, by - h * 0.32);
  },
  // Friday: the father, faceless, broad, in Will's coat; Saturn bent at the ceiling with only the eyes lit; the arm
  father(P) { (P.I.look === "saturn" ? saturn : P.I.look === "arm" ? arm : father)(P); },
  golem(P) { golem(P); },
};

// the father: legs like posts, a coat too broad for the room, arms hanging apart from it with big hands, a bowed
// head with no face
function father(P) {
  const { g, V, F, bx, by, H, w, ink, act, s, light } = P, sh = by - H * 0.78, skin = 0.34 * (0.7 + 0.6 * light);
  for (const k of [-1, 1]) limb(g, [[bx + k * w * 0.42, by], [bx + k * w * 0.4, by - H * 0.42]], 9, 9, ink);
  poly(g, [[bx - w * 1.15, sh + 3], [bx - w * 0.9, sh - 4], [bx + w * 0.9, sh - 4], [bx + w * 1.15, sh + 3], [bx + w * 0.95, by - H * 0.17], [bx - w * 0.95, by - H * 0.17]], ink);
  limb(g, [[bx + s * 2, sh - 2], [bx + s * 5, sh - H * 0.07]], 7, 7, ink);
  oval(g, bx + s * 6, sh - H * 0.13, w * 0.5, H * 0.1, ink);
  const hand = [bx + s * w * (1.45 - 0.35 * act), sh - H * 0.5 * act + H * (0.5 - 0.5 * act)];
  limb(g, [[bx - s * w * 1.12, sh + 3], [bx - s * w * 1.42, by - H * 0.5], [bx - s * w * 1.4, by - H * 0.3]], 8, 7, ink); oval(g, bx - s * w * 1.4, by - H * 0.27, 6, 7, skin);
  limb(g, [[bx + s * w * 1.12, sh + 3], [bx + s * w * (1.55 - 0.1 * act), sh - H * 0.25 * act + H * 0.26], hand], 8, 7, ink);
  // the hand that goes up is the tell: pale at the end of the dark arm
  oval(g, hand[0], hand[1], 7, 8, skin); feat(V, "hand", { boxes: [[hand[0] - 3, hand[1] - 3, 6, 6]], vs: [[(hand[0] + bx + s * w * 1.12) / 2 - 2, (hand[1] + sh) / 2 - 2, 4, 4]] });
  tip(V, F, hand[0], hand[1]);
}

// Saturn: grown to the ceiling, bent at the waist to fit under it, the head hanging forward; only the eyes lit
function saturn(P) {
  // grown through the split ceiling (DECISIONS-2026-10-22, staging call 2): 5.6 m, still bent, the head forward and down
  const { g, V, F, bx, by, w, s } = P, ink = 0.03, top = by - 5.6 * S + 4, waist = by - 2.4 * S, fwd = s * w * 3.6;
  limb(g, [[bx - w * 0.5, by], [bx - w * 0.5, waist]], 11, 11, ink); limb(g, [[bx + w * 0.5, by], [bx + w * 0.5, waist]], 11, 11, ink);
  poly(g, [[bx - w * 1.1, waist + 6], [bx + w * 1.1, waist + 6], [bx + fwd + s * w * 0.4, top + 18], [bx + fwd - s * w * 0.2, top], [bx - s * w * 1.0, top + 4]], ink);
  const hx = bx + fwd + s * w * 0.9, hy = top + 30;
  oval(g, hx, hy, w * 0.75, w * 0.9, ink);
  for (const k of [-1, 1]) { const ax = bx + fwd + k * w * 0.6; limb(g, [[ax, top + 14], [ax + s * 6, waist + 10], [ax + s * 4, by - 18]], 9, 7, ink); for (let f = -2; f <= 2; f++) limb(g, [[ax + s * 4, by - 18], [ax + s * 4 + f * 3, by - 8]], 2, 2, ink); }
  for (const k of [-1, 1]) { const ex = hx + k * 7 + s * 3, ey = hy + 4; oval(g, ex, ey, 6, 5, 0.6, 0.18); g.fillStyle = gray(0.97); g.fillRect(ex - 2, ey - 1, 4, 3); feat(V, "eye", { box: [ex - 2, ey - 1, 4, 3] }); }
  tip(V, F, hx, hy + 20);
}

// the arm: the father slumped behind the table, one arm across it, too long, the hand open and leaning
function arm(P) {
  const { g, V, F, bx, by, H, w, ink, s } = P, L = V.W.lamb(), sh = [bx + s * w * 0.6, by - H * 0.72];
  poly(g, [[bx - w * 1.2, by - H * 0.72], [bx + w * 1.2, by - H * 0.72], [bx + w * 0.9, by], [bx - w * 0.9, by]], ink);
  oval(g, bx - s * 3, by - H * 0.72, w * 0.45, H * 0.1, ink);
  const dx = L.x - F.x, dz = L.z - F.z, d = Math.hypot(dx, dz) || 1, reach = Math.max(2.6, d + 0.25), near = d < 2.4;
  const [hx, hy] = V.proj(F.x + (dx / d) * reach, F.z + (dz / d) * reach, near ? 1.5 : 0.9), [ex, ey] = V.proj(F.x + (dx / d) * reach * 0.45, F.z + (dz / d) * reach * 0.45, 0.95);
  const draw = (gg) => armOf(gg, V, F, P, sh, [ex, ey], [hx, hy]);
  if (near && L.z >= F.z) (V.overlays ||= []).push(draw); else draw(g);
}
function armOf(g, V, F, P, sh, elbow, hand) {
  // Will's coat sleeve, a shade above the dark (the lamp on the table is the only light in this phase)
  const { light } = P, ink = 0.16 * (0.7 + 0.6 * light), skin = 0.34 * (0.7 + 0.6 * light);
  limb(g, [sh, elbow, hand], 15, 11, ink);
  // the lamp on the table catches the top of the sleeve along its whole length: the arm reads in the dark kitchen
  g.strokeStyle = gray(0.42 * (0.7 + 0.6 * light)); g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.moveTo(sh[0], sh[1] - 6); g.lineTo(elbow[0], elbow[1] - 4.5); g.lineTo(hand[0], hand[1] - 3.5); g.stroke(); g.lineCap = "butt";
  const dir = Math.sign(hand[0] - elbow[0]) || 1, ux = hand[0] - elbow[0], uy = hand[1] - elbow[1], ul = Math.hypot(ux, uy) || 1, c = [hand[0] - (ux / ul) * 10, hand[1] - (uy / ul) * 10];
  g.strokeStyle = gray(0.82); g.lineWidth = 11; g.beginPath(); g.moveTo(c[0] - (ux / ul) * 2.5, c[1] - (uy / ul) * 2.5); g.lineTo(c[0] + (ux / ul) * 2.5, c[1] + (uy / ul) * 2.5); g.stroke();
  oval(g, hand[0], hand[1], 9, 5, skin);
  for (let f = -2; f <= 1; f++) limb(g, [[hand[0] + dir * 6, hand[1] + f * 2], [hand[0] + dir * 14, hand[1] + f * 3]], 3, 2, skin);
  limb(g, [[hand[0], hand[1] - 3], [hand[0] + dir * 6, hand[1] - 8]], 3, 2, skin);
  feat(V, "arm", { seg: [...elbow, ...hand], w: 9 }); feat(V, "cuff", { box: [c[0] - 3, c[1] - 4, 6, 8] });
  tip(V, F, hand[0], hand[1]);
}

// He's With Me: clay, blocky and heavy, the cell's iron door for a chest, one word cut into the brow
function golem(P) {
  const { g, V, F, d, I, bx, by, H, w, light, s } = P, clay = 0.3 * (0.65 + 0.7 * light), sh = by - H * 0.82;
  for (const k of [-1, 1]) poly(g, [[bx + k * w * 0.2, by], [bx + k * w * 0.85, by], [bx + k * w * 0.8, by - H * 0.38], [bx + k * w * 0.25, by - H * 0.38]], clay * 0.8);
  poly(g, [[bx - w * 1.5, sh], [bx + w * 1.5, sh], [bx + w * 1.05, by - H * 0.36], [bx - w * 1.05, by - H * 0.36]], clay);
  if (I.look === "cell" || I.look === "walls") for (const k of [-1, 1]) { poly(g, [[bx + k * w * 1.4, sh], [bx + k * w * 3.3, sh - 6], [bx + k * w * 3.4, sh + 8], [bx + k * w * 1.4, sh + 14]], clay * 0.85); poly(g, [[bx + k * w * 3.0, sh - 8], [bx + k * w * 3.6, sh - 10], [bx + k * w * 3.6, sh + 12], [bx + k * w * 3.0, sh + 10]], clay); }
  else for (const k of [-1, 1]) poly(g, [[bx + k * w * 1.5, sh], [bx + k * w * 1.95, sh + 6], [bx + k * w * 1.85, by - H * 0.15], [bx + k * w * 1.35, by - H * 0.12], [bx + k * w * 1.3, sh + 8]], clay * 0.85);
  const hy = sh - w * 0.45; poly(g, [[bx - w * 0.55, sh + 2], [bx + w * 0.55, sh + 2], [bx + w * 0.5, hy - w * 0.5], [bx - w * 0.5, hy - w * 0.5]], clay);
  for (let k = 0; k < 22; k++) { const x = bx + (hash(k, 1) - 0.5) * w * 2.6, y = sh + hash(k, 2) * H * 0.45; g.fillStyle = gray(clay * (hash(k, 3) > 0.5 ? 1.6 : 0.5)); g.fillRect(x, y, 3, 2); }
  const dx = bx - w * 0.5, dy = by - H * 0.74, dw = w, dh = H * 0.3;
  g.fillStyle = gray(0.015); g.fillRect(dx, dy, dw, dh); g.strokeStyle = gray(0.6); g.lineWidth = 2; g.strokeRect(dx, dy, dw, dh);
  for (let k = 1; k < 4; k++) { g.fillStyle = gray(0.45); g.fillRect(dx + (k * dw) / 4, dy + 3, 1, dh - 6); }
  feat(V, "door", { box: [dx, dy, dw, dh] });
  if (I.rubbed || (V.W.result && V.W.result.outcome === "laid")) oval(g, bx, hy - w * 0.25, w * 0.42, 4, 0.75, 0.8);
  else { g.fillStyle = gray(0.62); g.fillRect(bx - w * 0.55, hy - w * 0.42, w * 1.1, 10); g.fillStyle = gray(0.02); g.font = "bold 9px ui-monospace, monospace"; g.textAlign = "center"; g.fillText(d.word || "HELD", bx, hy - w * 0.42 + 8); g.textAlign = "left"; }
  feat(V, "word", { box: [bx - w * 0.55, hy - w * 0.42, w * 1.1, 10] });
  tip(V, F, bx + s * w * 1.8, by - H * 0.2);
}

// what a form lays on the floor before the bodies: Steady Hand's eye; Only's twelfth chair
export function formGround(V, g) {
  const I = V.W.inner || {}, A = V.W.field.arena;
  if (I.look === "eye") eyeOnFloor(V, g);
  const c = (A.anchors.chair12 || [])[0]; if (c) chair(V, g, c, I.look === "chair");
}

function eyeOnFloor(V, g) {
  const b = V.W.field.bounds, B = V.W.byId("boss"), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, rx = (b.x1 - b.x0) / 2 - 2.6, rz = (b.z1 - b.z0) / 2 - 1.6;
  const lid = (k) => Array.from({ length: 25 }, (_, i) => { const u = i / 24, x = cx - rx + 2 * rx * u, z = cz + k * rz * Math.sin(u * Math.PI); return V.proj(x, z); });
  const up = lid(-1), lo = lid(1);
  poly(g, [...up, ...lo.slice().reverse()], 0.42, 0.55);
  // the iris follows the boss but stays in the eye (he is the dark pooled in the pupil)
  if (B) { const ix = cx + Math.max(-0.55, Math.min(0.55, (B.x - cx) / rx)) * rx, iz = cz + Math.max(-0.35, Math.min(0.35, (B.z - cz) / rz)) * rz, [px, py] = V.proj(ix, iz), r = 2.3 * S; g.strokeStyle = gray(0.05); g.lineWidth = 10; g.beginPath(); g.ellipse(px, py, r, r * 0.62, 0, 0, Math.PI * 2); g.stroke(); for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; g.strokeStyle = gray(0.12); g.lineWidth = 1; g.beginPath(); g.moveTo(px + Math.cos(a) * r * 0.55, py + Math.sin(a) * r * 0.34); g.lineTo(px + Math.cos(a) * r * 0.92, py + Math.sin(a) * r * 0.57); g.stroke(); } oval(g, px, py, r * 0.5, r * 0.31, 0.01); feat(V, "pupil", { box: [px - r * 0.5, py - r * 0.31, r, r * 0.62] }); }
  for (const L of [up, lo]) { g.strokeStyle = gray(0.015); g.lineWidth = 7; g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  for (let i = 2; i < 23; i += 2) { const [x, y] = up[i]; g.strokeStyle = gray(0.015); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + (i - 12) * 0.6, y - 12); g.stroke(); if (i % 4 === 2) { g.strokeStyle = gray(0.78); g.lineWidth = 1; g.beginPath(); g.moveTo(x - 5, y + 6); for (let q = 0; q < 5; q++) g.lineTo(x - 5 + q * 2.5, y + 6 + (q % 2 ? -2 : 1)); g.stroke(); } }
  // a lid reads against the eye it closes: the lid band against the white just inside it (the wall outside the
  // bowl is as dark as the lid by design; the first measure, lid against both sides, read 4.6 to 22, PROGRESS 30)
  const [ecx, ecy] = V.proj(cx, cz);
  for (const L of [up, lo]) for (const i of [7, 10, 14, 17]) { const [x, y] = L[i], dl = Math.hypot(ecx - x, ecy - y) || 1, ix = x + ((ecx - x) / dl) * 11, iy = y + ((ecy - y) / dl) * 11; feat(V, "lid", { boxes: [[x - 2, y - 2, 4, 4]], vs: [[ix - 2, iy - 2, 4, 4]] }); }
}

function chair(V, g, [x, z], coat) {
  const [cx, cy] = V.proj(x, z);
  g.fillStyle = gray(0.12); g.fillRect(cx - 12, cy - 44, 3, 44); g.fillRect(cx + 9, cy - 44, 3, 44); g.fillRect(cx - 12, cy - 44, 24, 4); g.fillRect(cx - 12, cy - 22, 24, 4);
  if (coat) { poly(g, [[cx - 13, cy - 40], [cx + 13, cy - 40], [cx + 15, cy - 12], [cx - 15, cy - 12]], 0.06); poly(g, [[cx - 6, cy - 40], [cx + 6, cy - 40], [cx, cy - 30]], 0.0); g.strokeStyle = gray(0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 6, cy - 40); g.lineTo(cx, cy - 30); g.lineTo(cx + 6, cy - 40); g.stroke(); }
}
