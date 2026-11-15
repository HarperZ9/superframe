// The traits' bodies (design/TRAITS.md, the traits pass of 2026-10-23): PRUDENCE redrawn, the three lesser beings that
// had no body (JEALOUSY, DREAD, SHAME), and the four great traits that stand at the Descent's gates (HARDNESS, FEAR,
// SUSPICION, AUTHORITY). The rules are combat/arena/forms.mjs's: drawn in values for the silhouette first, the phase
// shown by shape, the parts that must read named with feat(). The look is the author's (2026-10-23): brutalist mass,
// art-deco steps and sunbursts, supergraphic stripes, surreal scale; every anatomy is the trait doing what it does.
import { gray, hash } from "./innerstage.mjs";
import { feat, tip, limb, poly, oval } from "./forms.mjs";

const lit = (v, light) => v * (0.62 + 0.5 * light);

// PRUDENCE: a broad man whose right arm is the exchange scale's iron beam, bolted at the shoulder; the pan hangs off
// the beam's end on two chains; his head is a stack of brass weights, his buttons are weights. The beam rises as he
// winds up and comes down on its stop: the stop is drawn as a bright notch at the shoulder
function prudence(P) {
  const { g, V, F, I, bx, by, H, w, ink, act, light, s } = P, low = I.look === "eye" ? 0.82 : 1, h = H * low, sh = by - h * 0.74;
  for (const k of [-1, 1]) limb(g, [[bx + k * w * 0.45, by], [bx + k * w * 0.42, by - h * 0.36]], 10, 10, ink);
  poly(g, [[bx - w * 1.25, sh], [bx + w * 1.25, sh], [bx + w * 1.05, by - h * 0.3], [bx - w * 1.05, by - h * 0.3]], ink);
  for (let k = 0; k < 4; k++) { g.fillStyle = gray(lit(0.62, light)); g.fillRect(bx - 3, sh + 8 + k * h * 0.09, 6, 4); }
  // the head: three weights, each smaller, a polished thumbprint on the top one
  for (let k = 0; k < 3; k++) { const ww = w * (0.62 - k * 0.14), y = sh - 4 - k * h * 0.07; poly(g, [[bx - ww, y], [bx + ww, y], [bx + ww * 0.82, y - h * 0.06], [bx - ww * 0.82, y - h * 0.06]], lit(0.72 + k * 0.06, light)); g.fillStyle = gray(0.05); g.fillRect(bx - ww, y - 1, ww * 2, 1); }
  oval(g, bx, sh - 4 - 2 * h * 0.07 - h * 0.05, w * 0.12, w * 0.07, lit(0.9, light));
  feat(V, "weights", { box: [bx - w * 0.62, sh - 4 - 3 * h * 0.07, w * 1.24, 3 * h * 0.07] });
  // the beam: from the shoulder out on his weapon side; up at the wind-up's start, down on the stop when it lands
  const a = (-0.35 + 0.9 * act) * (act > 0 ? 1 : 0.4), L = w * 3.4, root = [bx + s * w * 1.15, sh + 4];
  const end = [root[0] + s * Math.cos(a) * L, root[1] + Math.sin(a) * L];
  limb(g, [root, end], 7, 6, 0.04); limb(g, [root, end], 2, 2, lit(0.55, light));
  g.fillStyle = gray(act >= 1 ? 0.95 : 0.4); g.fillRect(root[0] - 3, root[1] - 6, 6, 4);
  const pan = [end[0], end[1] + w * 1.1];
  for (const k of [-1, 1]) { g.strokeStyle = gray(lit(0.7, light)); g.lineWidth = 1; g.beginPath(); g.moveTo(end[0], end[1]); g.lineTo(pan[0] + k * w * 0.55, pan[1]); g.stroke(); }
  g.fillStyle = gray(0.03); g.beginPath(); g.ellipse(pan[0], pan[1] + 1, w * 0.66, w * 0.27, 0, 0, Math.PI); g.fill();
  g.fillStyle = gray(lit(0.86, light)); g.beginPath(); g.ellipse(pan[0], pan[1], w * 0.6, w * 0.22, 0, 0, Math.PI); g.fill();
  feat(V, "beam", { seg: [...root, ...end], w: 6 }); feat(V, "pan", { box: [pan[0] - w * 0.6, pan[1] - 2, w * 1.2, w * 0.24] });
  limb(g, [[bx - s * w * 1.15, sh + 4], [bx - s * w * 1.4, by - h * 0.42]], 8, 7, ink);
  tip(V, F, pan[0], pan[1]);
}

// JEALOUSY: a hoarding fence that walks on the ends of its boards, a hole cut at eye height with one wet eye in it that
// follows you, and two arms long enough to reach over the top. The hole: the boards round the eye splinter outward.
// The eye: the eye is the whole hole, and the fence leans in after you
function jealousy(P) {
  const { g, V, F, I, bx, by, H, w, act, light, s } = P, L = V.W.lamb(), [lx, ly] = V.proj(L.x, L.z, 1.2);
  const fw = w * 2.2, top = by - H * 1.0, lean = I.look === "eye" ? s * w * 0.5 : 0, n = 7;
  for (let k = 0; k < n; k++) {
    const x0 = bx - fw + (k * 2 * fw) / n, x1 = x0 + (2 * fw) / n - 1, jag = (hash(k, 4) - 0.5) * 8;
    poly(g, [[x0, by], [x1, by], [x1 + lean, top + jag + 4], [(x0 + x1) / 2 + lean, top + jag - 4], [x0 + lean, top + jag + 4]], lit(k % 2 ? 0.26 : 0.34, light));
  }
  g.fillStyle = gray(0.05); g.fillRect(bx - fw + lean * 0.5, by - H * 0.62, fw * 2, 3);
  const hr = I.look === "eye" ? w * 0.7 : I.look === "hole" ? w * 0.5 : w * 0.36, hx = bx + lean * 0.7, hy = by - H * 0.78;
  oval(g, hx, hy, hr, hr * 0.62, 0.0);
  if (I.look === "hole" || I.look === "eye") for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; limb(g, [[hx + Math.cos(a) * hr, hy + Math.sin(a) * hr * 0.62], [hx + Math.cos(a) * hr * 1.5, hy + Math.sin(a) * hr * 0.9]], 2, 1, lit(0.4, light)); }
  const dx = lx - hx, dy = ly - hy, dl = Math.hypot(dx, dy) || 1, ex = hx + (dx / dl) * hr * 0.3, ey = hy + (dy / dl) * hr * 0.18;
  oval(g, ex, ey, hr * 0.75, hr * 0.42, lit(0.9, light)); oval(g, ex + (dx / dl) * hr * 0.2, ey, hr * 0.26, hr * 0.26, 0.02);
  feat(V, "eye", { box: [ex - hr * 0.75, ey - hr * 0.42, hr * 1.5, hr * 0.84] });
  for (const k of [-1, 1]) {
    const sh = [bx + k * fw * 0.6 + lean, top + 2], reach = k === s ? act : 0.15, hand = [sh[0] + k * w * (0.6 + 1.8 * reach), sh[1] - w * 0.6 + H * 0.5 * reach];
    limb(g, [sh, [sh[0] + k * w * 0.4, sh[1] - w * 0.9], hand], 4, 3, 0.05);
    for (let f = -1; f <= 1; f++) limb(g, [hand, [hand[0] + k * 7, hand[1] + f * 4 + 3]], 2, 1, lit(0.8, light));
    oval(g, hand[0], hand[1], 5, 4, lit(0.85, light));
    if (k === s) { feat(V, "reach", { box: [hand[0] - 4, hand[1] - 3, 8, 6] }); tip(V, F, hand[0], hand[1]); }
  }
}

// DREAD: a black door frame walking in a long coat hung from the lintel, the door open on nothing. Deco steps on the
// lintel; the dark inside bulges toward you as it winds up. The stair: pale steps going up inside the black. The open
// door: the frame doubles, and a second door stands open behind the first
function dread(P) {
  const { g, V, F, I, bx, by, H, w, act, light, s } = P, dw = w * 1.15, top = by - H * 1.02;
  const frame = (x, y, sc, v) => {
    poly(g, [[x - dw * 1.5 * sc, y], [x - dw * 1.2 * sc, y - H * 0.9 * sc], [x + dw * 1.2 * sc, y - H * 0.9 * sc], [x + dw * 1.5 * sc, y]], v * 0.6);
    g.fillStyle = gray(v); g.fillRect(x - dw * 1.1 * sc, y - H * sc, dw * 2.2 * sc, 4); g.fillRect(x - dw * 0.8 * sc, y - H * sc - 5, dw * 1.6 * sc, 5); g.fillRect(x - dw * 0.4 * sc, y - H * sc - 9, dw * 0.8 * sc, 4);
    g.fillRect(x - dw * sc - 4, y - H * sc, 4, H * sc); g.fillRect(x + dw * sc, y - H * sc, 4, H * sc);
    g.fillStyle = gray(0.0); g.fillRect(x - dw * sc, y - H * sc + 4, dw * 2 * sc, H * sc - 4);
  };
  if (I.look === "open") frame(bx - s * w * 1.2, by - 6, 0.82, lit(0.35, light));
  frame(bx, by, 1, lit(0.62, light));
  if (I.look === "stair" || I.look === "open") for (let k = 0; k < 6; k++) { const y = by - 8 - k * H * 0.12, x0 = bx - dw * 0.8 + k * dw * 0.12; g.fillStyle = gray(lit(0.12 + 0.03 * k, light)); g.fillRect(x0, y, dw * 1.6 - k * dw * 0.24, 2); }
  if (act > 0) oval(g, bx + s * dw * 0.5 * act, by - H * 0.5, dw * (0.6 + 0.5 * act), H * 0.3, 0.0);
  feat(V, "doorway", { box: [bx - dw, top + 4, dw * 2, H * 0.98] });
  tip(V, F, bx + s * dw * (0.5 + act), by - H * 0.5);
}

// SHAME: a hunched figure wound in wet grey sheets, its head turned away over its shoulder so you only ever see the
// back of it; water runs off the hem. The sheets: more sheets trail out across the floor toward you, pulling. The
// face: the sheets slip and a pale cheek shows, turned from you, no features
function shame(P) {
  const { g, V, F, I, bx, by, H, w, act, light, s } = P, hunch = H * 0.82, sh = by - hunch * 0.78;
  for (let k = 0; k < 5; k++) {
    const y0 = by - k * hunch * 0.17, y1 = y0 - hunch * 0.24, ww = w * (1.35 - k * 0.14), off = (hash(k, 6) - 0.5) * 6 - s * k * 2;
    poly(g, [[bx - ww + off, y0], [bx + ww + off, y0 - 3], [bx + ww * 0.9 + off - s * 4, y1], [bx - ww * 0.9 + off, y1 + 3]], lit(0.4 + 0.07 * (k % 2), light));
    g.strokeStyle = gray(lit(0.22, light)); g.lineWidth = 1; g.beginPath(); g.moveTo(bx - ww + off, y0 - 2); g.lineTo(bx + ww * 0.6 + off, y1 + 6); g.stroke();
  }
  const hx = bx - s * w * 0.4, hy = sh - w * 0.35;
  oval(g, hx, hy + w * 0.5, w * 0.75, w * 0.26, lit(0.8, light)); // the wet sheet wound up round the neck, pale under the dark head
  oval(g, hx, hy, w * 0.48, w * 0.55, 0.03);
  for (let k = -2; k <= 2; k++) limb(g, [[hx + k * 3, hy - w * 0.5], [hx + k * 4 - s * 3, hy - w * 0.18]], 1, 1, lit(0.42, light));
  if (I.look === "face") { oval(g, hx - s * w * 0.42, hy + 2, w * 0.16, w * 0.3, lit(0.78, light)); feat(V, "cheek", { box: [hx - s * w * 0.42 - w * 0.16, hy - w * 0.28, w * 0.32, w * 0.6] }); }
  feat(V, "turned", { box: [hx - w * 0.28, hy - w * 0.12, w * 0.56, w * 0.5] }); // the back of the head, below the hair
  const arm = [bx + s * w * (1.1 + 1.4 * act), by - hunch * (0.35 + 0.2 * act)];
  limb(g, [[bx + s * w * 0.7, sh + 6], arm], 7, 5, lit(0.34, light)); oval(g, arm[0], arm[1], 5, 4, lit(0.88, light));
  for (let k = 0; k < 6; k++) { const x = bx + (hash(k, 8) - 0.5) * w * 2.4, l = 4 + hash(k, 9) * 8; g.fillStyle = gray(lit(0.55, light)); g.fillRect(x, by - 1, 1, l * 0.3); g.fillRect(x - 2, by + l * 0.3, 4, 1); }
  if (I.look === "sheets" || I.look === "face") for (let k = 0; k < 3; k++) { const z = by + 4 + k * 5; poly(g, [[bx - s * w * 0.4, z - 4], [bx + s * w * (3 + k), z], [bx + s * w * (3 + k), z + 3], [bx - s * w * 0.4, z + 2]], lit(0.36, light), 0.8); }
  feat(V, "hand", { box: [arm[0] - 4, arm[1] - 4, 8, 8] });
  tip(V, F, arm[0], arm[1]);
}

// HARDNESS: a man poured in concrete, slab on slab, the shuttering's board marks running across every block, the sacks
// he carried set into his chest like stones in a wall, rebar standing out of his fists
function hardness(P) {
  const { g, V, F, I, bx, by, H, w, act, light, s } = P, c = (k) => lit(0.36 + 0.05 * (k % 3), light), h = H * (I.scale || 1);
  const block = (x0, y0, x1, y1, k) => { poly(g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], c(k)); for (let y = y1 + 4; y < y0; y += 5) { g.fillStyle = gray(lit(0.22, light)); g.fillRect(x0 + 1, y, x1 - x0 - 2, 1); } g.fillStyle = gray(0.05); g.fillRect(x0, y0 - 1, x1 - x0, 1); };
  block(bx - w * 0.95, by, bx - w * 0.2, by - h * 0.38, 0); block(bx + w * 0.2, by, bx + w * 0.95, by - h * 0.38, 1);
  block(bx - w * 1.5, by - h * 0.36, bx + w * 1.5, by - h * 0.82, 2);
  block(bx - w * 0.5, by - h * 0.82, bx + w * 0.5, by - h * 1.0, 0);
  for (let k = 0; k < 5; k++) { const x = bx - w * 1.1 + k * w * 0.55, y = by - h * (0.48 + (k % 2) * 0.14); oval(g, x, y, w * 0.26, w * 0.18, 0.03); oval(g, x, y, w * 0.24, w * 0.16, lit(0.86, light)); g.fillStyle = gray(0.08); g.fillRect(x - 1, y - w * 0.16, 2, w * 0.32); }
  { const x = bx - w * 1.1, y = by - h * 0.48; feat(V, "sacks", { box: [x - w * 0.16, y - w * 0.1, w * 0.12, w * 0.2] }); } // one sack set in the wall of him
  for (const k of [-1, 1]) {
    const fist = [bx + k * w * (1.9 + (k === s ? 0.9 * act : 0)), by - h * (0.42 + (k === s ? 0.3 * act : 0))];
    block(Math.min(bx + k * w * 1.5, fist[0]) - 2, fist[1] + w * 0.4, Math.max(bx + k * w * 1.5, fist[0]) + 2, fist[1] - w * 0.4, 1);
    for (let r = 0; r < 3; r++) limb(g, [[fist[0], fist[1] - 4 + r * 4], [fist[0] + k * (10 + r * 3), fist[1] - 8 + r * 5]], 2, 1, lit(0.9, light));
    oval(g, fist[0], fist[1], 5, 5, lit(0.8, light));
    if (k === s) { feat(V, "fist", { box: [fist[0] - 5, fist[1] - 5, 10, 10] }); tip(V, F, fist[0] + k * 10, fist[1]); }
  }
}

// FEAR: a tall figure painted in stripes, and the stripes do not stop at its edge: they run out across the arena as
// bands on the far wall, so the figure is only where the bands bend. Seventies supergraphic; it never has a face
function fear(P) {
  const { g, V, F, bx, by, H, w, act, light, s, ph } = P, h = H * 1.05, wob = Math.sin(V.t * 0.08) * 3, bands = 7;
  const outline = [[bx - w * 0.7, by], [bx - w * 0.9, by - h * 0.55], [bx - w * 1.3 - s * w * act, by - h * 0.78], [bx - w * 0.5, by - h * 0.92], [bx, by - h + wob], [bx + w * 0.5, by - h * 0.92], [bx + w * 1.3 + s * w * act * 1.6, by - h * 0.7], [bx + w * 0.9, by - h * 0.55], [bx + w * 0.7, by]];
  const b = V.W.field.bounds, [xl] = V.proj(b.x0, F.z), [xr] = V.proj(b.x1, F.z);
  for (let k = 0; k < bands; k++) {
    const y = by - (k + 0.5) * (h / bands), v = lit(k % 2 ? 0.08 : 0.5 + 0.06 * ph, light), bend = Math.sin((k + V.t * 0.02) * 1.3) * 5;
    g.fillStyle = gray(v, 0.45); g.fillRect(xl, y - 3 + bend * 0.3, bx - w * 1.4 - xl, 5); g.fillRect(bx + w * 1.4, y - 3 - bend * 0.3, xr - bx - w * 1.4, 5);
  }
  g.save(); g.beginPath(); outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
  for (let k = 0; k < bands * 2; k++) { const y = by - (k + 0.5) * (h / (bands * 2)); g.fillStyle = gray(k % 2 ? 0.03 : lit(0.88, light)); g.beginPath(); g.moveTo(bx - w * 2, y - 4); g.quadraticCurveTo(bx, y - 10 + wob, bx + w * 2, y - 4); g.lineTo(bx + w * 2, y + 3); g.quadraticCurveTo(bx, y - 3 + wob, bx - w * 2, y + 3); g.fill(); }
  g.restore();
  g.strokeStyle = gray(0.02); g.lineWidth = 2; g.beginPath(); outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
  { const y = by - (2 + 0.5) * (h / (bands * 2)) - 2; feat(V, "stripes", { box: [bx - w * 0.35, y - 2, w * 0.7, 3] }); } // one pale band where it bends
  tip(V, F, outline[6][0], outline[6][1]);
}

// SUSPICION: an art-deco stepped column with a sunburst for a head; every ray is an eye-slit, and the centre is an
// eye that turns to follow you. The rays turn slowly; when it winds up they all point at you
function suspicion(P) {
  const { g, V, F, by, bx, H, w, act, light } = P, L = V.W.lamb(), [lx, ly] = V.proj(L.x, L.z, 1.2);
  for (let k = 0; k < 4; k++) { const ww = w * (1.3 - k * 0.22), y0 = by - k * H * 0.16, y1 = y0 - H * 0.16; poly(g, [[bx - ww, y0], [bx + ww, y0], [bx + ww, y1], [bx - ww, y1]], lit(0.3 + 0.04 * k, light)); g.fillStyle = gray(lit(0.7, light)); g.fillRect(bx - ww, y1, ww * 2, 2); for (let f = -2; f <= 2; f++) { g.fillStyle = gray(0.08); g.fillRect(bx + f * ww * 0.36, y1 + 4, 1, H * 0.16 - 6); } }
  const cx = bx, cy = by - H * 0.8, R = w * 2.1, toward = Math.atan2(ly - cy, lx - cx), n = 14;
  for (let k = 0; k < n; k++) {
    const base = (k / n) * Math.PI * 2 + V.t * 0.004, a = base + (toward - base) * act * 0.85 * (k % 2), r0 = w * 0.55, r1 = R * (k % 2 ? 1 : 0.78);
    poly(g, [[cx + Math.cos(a - 0.09) * r0, cy + Math.sin(a - 0.09) * r0 * 0.8], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8], [cx + Math.cos(a + 0.09) * r0, cy + Math.sin(a + 0.09) * r0 * 0.8]], lit(0.86, light));
    const m = (r0 + r1) * 0.6; g.fillStyle = gray(0.02); g.fillRect(cx + Math.cos(a) * m - 2, cy + Math.sin(a) * m * 0.8 - 1, 4, 2);
  }
  oval(g, cx, cy, w * 0.55, w * 0.45, lit(0.85, light));
  const dl = Math.hypot(lx - cx, ly - cy) || 1; oval(g, cx + ((lx - cx) / dl) * w * 0.22, cy + ((ly - cy) / dl) * w * 0.15, w * 0.2, w * 0.2, 0.02);
  feat(V, "sunburst", { box: [cx - w * 0.4, cy - w * 0.3, w * 0.25, w * 0.6] }); // the white of the eye at its centre
  tip(V, F, cx + Math.cos(toward) * R, cy + Math.sin(toward) * R * 0.8);
}

// AUTHORITY: a stepped tower of a man, a crown of iron rays standing off his head, a polished face that shows you
// yourself, small; he stands on a plinth of wet clay and never kneels to it (the one who would not bow to clay). His
// arms are blocks; the one he strikes with comes down like a gate
function authority(P) {
  const { g, V, F, bx, by, H, w, act, light, s } = P, clay = lit(0.3, light);
  poly(g, [[bx - w * 1.6, by], [bx + w * 1.6, by], [bx + w * 1.4, by - H * 0.1], [bx - w * 1.4, by - H * 0.1]], clay);
  for (let k = 0; k < 9; k++) { g.fillStyle = gray(clay * (hash(k, 2) > 0.5 ? 1.5 : 0.6)); g.fillRect(bx - w * 1.4 + hash(k, 1) * w * 2.8, by - H * 0.08 + hash(k, 3) * H * 0.06, 3, 2); }
  for (let k = 0; k < 4; k++) { const ww = w * (1.2 - k * 0.2), y0 = by - H * (0.1 + k * 0.19), y1 = y0 - H * 0.19; poly(g, [[bx - ww, y0], [bx + ww, y0], [bx + ww, y1], [bx - ww, y1]], lit(0.12 + 0.03 * k, light)); g.fillStyle = gray(lit(0.66, light)); g.fillRect(bx - ww, y1, ww * 2, 1); }
  const hy = by - H * 0.95;
  for (let k = 0; k < 11; k++) { const a = -Math.PI * (0.12 + 0.76 * (k / 10)), p0 = [bx + Math.cos(a) * w * 0.5, hy + Math.sin(a) * w * 0.4], p1 = [bx + Math.cos(a) * w * 1.7, hy + Math.sin(a) * w * 1.4]; limb(g, [p0, p1], 6, 4, 0.03); limb(g, [p0, p1], 3, 2, lit(0.92, light)); if (k === 5) feat(V, "crown", { seg: [...p0, ...p1], w: 2 }); }
  oval(g, bx, hy, w * 0.48, w * 0.55, lit(0.92, light)); g.fillStyle = gray(0.05); g.fillRect(bx - 2, hy - 4, 4, 9); oval(g, bx, hy - 6, 2.5, 2.5, 0.05);
  feat(V, "mirror", { box: [bx - w * 0.48, hy - w * 0.55, w * 0.96, w * 1.1] });
  for (const k of [-1, 1]) {
    const up = k === s ? act : 0, sh = [bx + k * w * 1.0, by - H * 0.72], hand = [bx + k * w * (1.6 + 0.4 * up), by - H * (0.38 + 0.5 * up)];
    poly(g, [[sh[0] - 6, sh[1]], [sh[0] + 6, sh[1]], [hand[0] + 7, hand[1]], [hand[0] - 7, hand[1]]], lit(0.14, light));
    g.fillStyle = gray(lit(0.6, light)); g.fillRect(hand[0] - 8, hand[1] - 3, 16, 6);
    if (k === s) tip(V, F, hand[0], hand[1]);
  }
}

export const FORMS5 = { prudence, jealousy, dread, shame, hardness, fear, suspicion, authority };
