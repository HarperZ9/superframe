// The inner bosses' forms, second half (combat/arena/forms.mjs has the rules they follow): the Minotaur, the pole and
// its carts, the sacks, the Accuser with the rack behind him, the Host and its limbs.
import { gray, hash } from "./innerstage.mjs";
import { feat, tip, limb, poly, oval } from "./forms.mjs";
import { drawLambInner } from "./innerfigure.mjs";

const S = 30;

// Nearest One: Will's greatcoat with a bull's mass in the shoulders, head down, horns of the wicket bar's iron; at
// the gap it is the player's own shape
function beast(P) {
  const { g, V, F, bx, by, H, w, ink, s, act } = P;
  if (P.I.look === "gap") { drawLambInner(g, V, F, { kind: "free" }, P.light, { height: V.W.defs.lamb.height, value: 0.05 }); tip(V, F, bx + s * w, by - H * 0.5); return; }
  poly(g, [[bx - w * 1.5, by], [bx + w * 1.5, by], [bx + w * 0.9, by - H * 0.6], [bx - w * 0.9, by - H * 0.6]], ink);
  oval(g, bx - s * w * 0.1, by - H * 0.68, w * 1.45, H * 0.24, ink);
  const hx = bx + s * w * (1.15 + 0.3 * act), hy = by - H * 0.56 + 4 * act;
  poly(g, [[bx + s * w * 0.6, by - H * 0.8], [hx + s * 4, hy - 8], [hx + s * 8, hy + 8], [bx + s * w * 0.5, by - H * 0.5]], ink);
  oval(g, hx, hy, w * 0.5, w * 0.42, ink);
  for (const k of [-1, 1]) {
    const root = [hx + k * 5, hy - 5], mid = [hx + k * w * 0.95 + s * 6, hy - w * 0.55], end = [hx + k * w * 0.75 + s * w * 0.9, hy - w * 1.25];
    limb(g, [root, mid, end], 6, 4, 0.02); limb(g, [root, mid, end], 3, 2, 0.6);
    feat(V, "horn", { seg: [...mid, ...end], w: 3 });
  }
  for (const k of [-1, 1]) { g.fillStyle = gray(0.2); g.fillRect(bx + k * w * 0.45 - 1, by - H * 0.45, 2, 3); }
  tip(V, F, hx + s * w * 0.9, hy - w * 0.6);
}

// Forty Carts: the barrier pole jointed like an arm (striped, as a barrier is), a lantern for a face
function pole(P) {
  const { g, V, F, bx, by, H, w, ink, s, act } = P;
  g.fillStyle = gray(ink); g.fillRect(bx - 4, by - H * 0.95, 8, H * 0.95);
  const j = [bx, by - H * 0.78], el = [j[0] + s * w * 2.0, j[1] - 6 - 10 * act], a = 0.25 + 0.9 * act, end = [el[0] + s * Math.cos(a) * w * 2.2, el[1] + Math.sin(a) * w * 2.2 * 0.8];
  for (const [p, q] of [[j, el], [el, end]]) {
    const n = 8; for (let k = 0; k < n; k++) { const u0 = k / n, u1 = (k + 1) / n; g.strokeStyle = gray(k % 2 ? 0.08 : 0.82); g.lineWidth = 5; g.beginPath(); g.moveTo(p[0] + (q[0] - p[0]) * u0, p[1] + (q[1] - p[1]) * u0); g.lineTo(p[0] + (q[0] - p[0]) * u1, p[1] + (q[1] - p[1]) * u1); g.stroke(); }
  }
  oval(g, el[0], el[1], 4, 4, 0.04); oval(g, j[0], j[1], 4, 4, 0.04);
  feat(V, "boom", { seg: [...el, ...end], w: 5, pattern: true });
  const tb = [bx - w * 0.75, by - H * 0.95 - w * 0.95, w * 1.5, w * 0.9];
  g.fillStyle = gray(0.06); g.fillRect(...tb); oval(g, tb[0] + tb[2] / 2, tb[1] + tb[3] / 2, tb[2] * 0.3, tb[3] * 0.35, 0.85);
  feat(V, "lantern", { box: tb, pattern: true });
  tip(V, F, end[0], end[1]);
}

// a cart and a horse, never a person: big wheels with pale iron rims, the bed, the shafts, the horse's head down
function cart(P) {
  const { g, V, F, bx, by, ink, s } = P, w = Math.max(P.w, 26), r = w * 0.62;
  g.fillStyle = gray(ink); g.fillRect(bx - w * 1.3, by - w * 1.3, w * 2.6, w * 0.75);
  g.fillStyle = gray(0.2); for (let k = 0; k < 3; k++) g.fillRect(bx - w * 1.3, by - w * 1.3 + 3 + k * 5, w * 2.6, 1);
  for (const k of [-0.75, 0.75]) { const cx = bx + k * w, cy = by - r; g.strokeStyle = gray(0.7); g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = gray(0.05); g.lineWidth = 1; for (let q = 0; q < 6; q++) { const a = (q * Math.PI) / 3 + V.t * 0.02; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); } if (k > 0) feat(V, "wheel", { box: [cx - r, cy - r, 2 * r, 2 * r] }); }
  const hx = bx + s * w * 2.3, hy = by - w * 1.25;
  g.strokeStyle = gray(0.1); g.lineWidth = 2; g.beginPath(); g.moveTo(bx + s * w * 1.3, by - w * 1.0); g.lineTo(hx - s * w * 0.6, hy + 2); g.stroke();
  oval(g, hx, hy, w * 0.85, w * 0.4, ink);
  for (const k of [-0.6, -0.35, 0.35, 0.6]) limb(g, [[hx + k * w, hy + 3], [hx + k * w + s * 2, by]], 3, 2, ink);
  limb(g, [[hx + s * w * 0.6, hy - 2], [hx + s * w * 1.0, hy - w * 0.7], [hx + s * w * 1.35, hy - w * 0.2]], 6, 4, ink);
  limb(g, [[hx - s * w * 0.8, hy - 1], [hx - s * w * 1.0, hy + w * 0.6]], 2, 1, ink);
  feat(V, "horse", { box: [hx - w * 0.85, hy - w * 0.7, w * 2.2, w * 1.5] });
  tip(V, F, hx + s * w * 1.35, hy - w * 0.2);
}

// Nobody Checks: forty sacks stacked as a body, full from the front; from the player's side (as he comes round to
// the near side of it, toward the viewer) the middle of the stack is empty, a shell of sacks round nothing. No numeral
// (DECISIONS-2026-10-22, staging call 4): the false count is the shape
function sacks(P) {
  const { g, V, F, bx, by, H, w, light } = P, rows = [4, 3, 2, 1], rh = H / 4.2, L = V.W.lamb(), hollow = Math.max(0, Math.min(1, (L.z - F.z + 0.3) / 1.2));
  rows.forEach((n, r) => { for (let c = 0; c < n; c++) { const x = bx + (c - (n - 1) / 2) * w * 0.68, y = by - rh * (r + 0.55); oval(g, x, y, w * 0.36, rh * 0.55, (0.3 + 0.08 * hash(r, c)) * (0.6 + 0.6 * light)); g.fillStyle = gray(0.03); g.fillRect(x - w * 0.36, y + rh * 0.45, w * 0.72, 1); g.fillStyle = gray(0.62); g.fillRect(x - 1, y - rh * 0.6, 3, 3); } });
  if (hollow > 0) {
    const cw = w * 1.35 * hollow, top = by - rh * 2.9, bot = by - rh * 0.35;
    poly(g, [[bx - cw * 0.35, top], [bx + cw * 0.35, top], [bx + cw * 0.62, bot], [bx - cw * 0.62, bot]], 0.008);
    // inside the shell: the backs of the far sacks, dim, so the dark reads as a space and not as paint
    for (let k = -1; k <= 1; k++) oval(g, bx + k * cw * 0.24, top + rh * 0.55, cw * 0.13, rh * 0.32, 0.16 * (0.6 + 0.6 * light));
    g.strokeStyle = gray(0.5 * (0.6 + 0.6 * light)); g.lineWidth = 1; g.beginPath(); g.moveTo(bx - cw * 0.35, top); g.lineTo(bx - cw * 0.62, bot); g.moveTo(bx + cw * 0.35, top); g.lineTo(bx + cw * 0.62, bot); g.stroke();
    g.strokeStyle = gray(0.18); g.lineWidth = 1; for (let k = 1; k < 4; k++) { const y = top + ((bot - top) * k) / 4; g.beginPath(); g.moveTo(bx - cw * (0.35 + 0.27 * k / 4) + 2, y); g.lineTo(bx + cw * (0.35 + 0.27 * k / 4) - 2, y); g.stroke(); }
    if (hollow > 0.6) feat(V, "hollow", { boxes: [[bx - cw * 0.2, (top + bot) / 2 - 3, cw * 0.4, 6]], vs: [[bx - w * 1.25, by - rh * 0.8, 6, 6], [bx + w * 1.25 - 6, by - rh * 0.8, 6, 6]] });
  }
  tip(V, F, bx + w, by - H * 0.5);
}

// the Accuser, in the base look: a man of no particular age in a good coat, a cane across his knees, at the player's
// shoulder's height across a bare table; behind him a coat stand hung with the traits the run fed, cut back or lost to,
// each a limb on a hook (04-ADVERSARY; the traits pass, 2026-10-23: no desk, no pen, nothing read)
function accuser(P) {
  const { g, V, F, I, bx, by, H, w, light } = P;
  rack(g, V, bx, by - 30, I.limbs || []);
  poly(g, [[bx - w * 0.8, by - H * 0.75], [bx + w * 0.8, by - H * 0.75], [bx + w, by - H * 0.3], [bx - w, by - H * 0.3]], 0.12);
  oval(g, bx, by - H * 0.95, w * 0.36, w * 0.42, 0.55 * (0.6 + 0.6 * light)); oval(g, bx, by - H * 1.03, w * 0.38, w * 0.2, 0.08);
  g.fillStyle = gray(0.16); g.fillRect(bx - w * 2.2, by - H * 0.42, w * 4.4, H * 0.1); g.fillRect(bx - w * 2.0, by - H * 0.32, 4, H * 0.32); g.fillRect(bx + w * 2.0 - 4, by - H * 0.32, 4, H * 0.32);
  g.fillStyle = gray(0.5); g.fillRect(bx - w * 2.2, by - H * 0.42, w * 4.4, 1);
  // the cane across his knees, its ferrule catching the lamp
  g.strokeStyle = gray(0.05); g.lineWidth = 3; g.beginPath(); g.moveTo(bx - w * 1.2, by - H * 0.36); g.lineTo(bx + w * 1.3, by - H * 0.46 + Math.sin(V.t * 0.05) * 1.5); g.stroke();
  g.fillStyle = gray(0.9); g.fillRect(bx + w * 1.3 - 2, by - H * 0.47, 3, 2);
  tip(V, F, bx + w * 1.3, by - H * 0.46);
}

const MARK = { prudence: "fist", father: "arm", golem: "clay", beast: "horns", coat: "sleeve", pole: "boom" };
function rack(g, V, x, y, kept) {
  // a coat stand, taller than a man: a turned pole, a crown of iron hooks, and on each hook a limb of a fed trait
  const h = 2.6 * S * 0.9, w = 34;
  g.fillStyle = gray(0.05); g.fillRect(x - 3, y - h, 6, h); g.fillStyle = gray(0.3); g.fillRect(x - 3, y - h, 1, h);
  poly(g, [[x - 16, y], [x + 16, y], [x + 4, y - 10], [x - 4, y - 10]], 0.06);
  for (let k = 0; k < 6; k++) { const a = -Math.PI * (0.15 + 0.7 * (k / 5)); limb(g, [[x, y - h + 6], [x + Math.cos(a) * 16, y - h + 6 + Math.sin(a) * 8], [x + Math.cos(a) * 18, y - h + 12]], 2, 2, 0.08); }
  kept.forEach((id, i) => { const side = i % 2 ? 1 : -1, yy = y - h + 14 + i * 16; limbShape(g, MARK[(V.W.defs[`boss-limb-${id}`] || {}).limbForm] || MARK[id] || "arm", [x + side * 6, yy], [x + side * (w / 2 + 26), yy + 10], 0.04); });
  feat(V, "rack", { box: [x - w / 2, y - h, w, h] });
}

// the Host: the run's kept lies in one body, the town's coats hung on it like rags on a scarecrow, Abel's hat,
// wings of tarred cloth that beat; smaller with every name (and never taller than the Brack kitchen's ceiling)
function host(P) {
  const { g, V, F, I, bx, by, H, w, ink, act, light } = P, h = H * Math.max(0.55, I.scale || 1), up = Math.sin(act * Math.PI) * 0.5 + (act > 0.85 ? -0.3 : 0);
  for (const k of [-1, 1]) {
    const r = [bx + k * w * 0.7, by - h * 0.7], pts = [r]; for (let q = 0; q <= 6; q++) { const u = q / 6; pts.push([r[0] + k * w * 2.6 * Math.sin(u * 1.6), r[1] - h * (0.75 + up) * Math.sin(u * Math.PI) + u * h * 0.4 + (q % 2) * 6]); }
    poly(g, pts, 0.3 * (0.7 + 0.5 * light));
    for (let q = 1; q < 6; q++) { const [x, y] = pts[q], [x2, y2] = pts[q + 1]; poly(g, [[x, y], [x2, y2], [(x + r[0]) / 2, (y + r[1]) / 2 + 6]], (0.22 + 0.08 * (q % 2)) * (0.7 + 0.5 * light)); }
    const top = Math.min(...pts.map((p) => p[1])), c = [(pts[2][0] + pts[3][0] + r[0]) / 3, (pts[2][1] + pts[3][1] + r[1]) / 3 + 6];
    feat(V, "wing", { boxes: [[c[0] - 4, c[1] - 4, 8, 8]], vs: [[pts[3][0] - 4, top - 14, 8, 6]] });
  }
  poly(g, [[bx - w * 1.2, by], [bx + w * 1.2, by], [bx + w * 0.9, by - h * 0.85], [bx - w * 0.9, by - h * 0.85]], ink);
  for (let k = 0; k < 7; k++) { const x = bx - w * 0.85 + ((k * 23) % (w * 1.5)), y = by - h * (0.18 + (k % 4) * 0.16); g.fillStyle = gray(0.3 * (0.7 + 0.3 * light)); g.fillRect(x, y, 9, 13); g.fillStyle = gray(0.08); g.fillRect(x + 4, y, 1, 13); } // coats hung on it
  oval(g, bx, by - h * 0.93, w * 0.42, w * 0.34, 0.75 * (0.6 + 0.4 * light));
  g.fillStyle = gray(0.03); g.fillRect(bx - w * 0.9, by - h * 1.02, w * 1.8, 3); g.fillRect(bx - w * 0.45, by - h * 1.02 - w * 0.5, w * 0.9, w * 0.5);
  feat(V, "hat", { box: [bx - w * 0.9, by - h * 1.02 - w * 0.5, w * 1.8, w * 0.5 + 3] });
  tip(V, F, bx, by - h * 0.7);
}

// a part of a kept lie, drawn big enough to be faced: the fist, the long arm, the clay fist, the iron horn,
// the empty sleeve, the striped boom
function limbShape(g, kind, a, b, ink, grow = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, n = [-dy / L, dx / L];
  if (kind === "fist") { limb(g, [a, b], 7 + grow, 5 + grow, ink); oval(g, b[0], b[1], 5 + grow / 2, 4 + grow / 2, ink); if (grow) return; limb(g, [[b[0], b[1] - 2], [b[0] + dx / L * 12, b[1] + dy / L * 12 - 5]], 3, 2, 0.04); }
  else if (kind === "arm") { limb(g, [a, b], 9 + grow, 7 + grow, ink); oval(g, b[0], b[1], 7 + grow / 2, 4 + grow / 2, ink); if (grow) return; for (let f = -1; f <= 1; f++) limb(g, [b, [b[0] + dx / L * 9 + n[0] * f * 3, b[1] + dy / L * 9 + n[1] * f * 3]], 2, 2, ink); g.fillStyle = gray(0.05); g.fillRect(b[0] - dx / L * 6 - 2, b[1] - dy / L * 6 - 3, 4, 6); }
  else if (kind === "clay") { limb(g, [a, b], 10 + grow, 10 + grow, grow ? ink : 0.22); if (grow) return; g.fillStyle = gray(0.22); g.fillRect(b[0] - 8, b[1] - 8, 16, 14); g.fillStyle = gray(0.65); g.fillRect(b[0] - 7, b[1] - 6, 14, 4); }
  else if (kind === "horns") { const m = [(a[0] + b[0]) / 2 + n[0] * 6, (a[1] + b[1]) / 2 + n[1] * 6]; limb(g, [a, m, b], 7 + grow, 3 + grow, 0.02); if (!grow) limb(g, [a, m, b], 4, 2, 0.6); }
  else if (kind === "sleeve" && grow) limb(g, [a, b], 13 + grow, 15 + grow, ink);
  else if (grow) limb(g, [a, b], 6 + grow, 6 + grow, ink);
  else if (kind === "sleeve") { poly(g, [[a[0] + n[0] * 5, a[1] + n[1] * 5], [b[0] + n[0] * 7, b[1] + n[1] * 7], [b[0] - n[0] * 7, b[1] - n[1] * 7], [a[0] - n[0] * 5, a[1] - n[1] * 5]], ink); oval(g, b[0], b[1], 4, 6, 0.0); g.strokeStyle = gray(0.6); g.lineWidth = 2; g.beginPath(); g.ellipse(b[0], b[1], 4, 6, 0, 0, Math.PI * 2); g.stroke(); }
  else { for (let k = 0; k < 6; k++) { const u0 = k / 6, u1 = (k + 1) / 6; g.strokeStyle = gray(k % 2 ? 0.08 : 0.82); g.lineWidth = 6; g.beginPath(); g.moveTo(a[0] + dx * u0, a[1] + dy * u0); g.lineTo(a[0] + dx * u1, a[1] + dy * u1); g.stroke(); } }
}

// a limb: a kept lie on the Host's body, joined to it by a cord of its own stuff
function limbForm(P) {
  const { g, V, F, d, bx, by, H } = P, B = V.W.byId("boss"), kind = MARK[d.limbForm] || "arm";
  const hb = B ? V.W.defs[B.id].height * Math.max(0.55, V.W.inner.scale || 1) : 2.6, root = B ? V.proj(B.x, B.z, hb * 0.6) : [bx, by - H * 0.9], end = [bx, by - H * 0.9];
  const cord = [root, [(root[0] + end[0]) / 2, Math.max(root[1], end[1]) + 6], end];
  limb(g, cord, 9, 9, 0.03); limb(g, cord, 6, 6, 0.4); limb(g, cord, 1, 1, 0.08);
  const dx = end[0] - root[0], dy = end[1] - root[1], dl = Math.hypot(dx, dy) || 1, out = [end[0] + (dx / dl) * 1.3 * S, end[1] + (dy / dl) * 0.6 * S - 6];
  limbShape(g, kind, end, out, 0.03, 3); limbShape(g, kind, end, out, 0.42);
  feat(V, `limb:${kind}`, { seg: [...end, ...out], w: 8 });
  tip(V, F, out[0], out[1]);
}

export const FORMS2 = { beast, pole, cart, sacks, accuser, host, limb: limbForm };
