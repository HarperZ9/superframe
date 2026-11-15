// The inner bosses' forms, era 5 (combat/arena/forms.mjs has the rules they follow): Order's riot shield, made three
// and then a wall; the lantern and the van light that come in with it; Everybody Says' crier's horn, its heads and the
// verge they sink into. Heads only, no bodies, no faces (inferno/03-BESTIARY-B, boss 12). Placeholder forms until the
// character lead's production forms exist, drawn for their silhouettes at game scale.
import { gray, hash } from "./innerstage.mjs";
import { feat, tip, limb, poly, oval } from "./forms.mjs";

// Order: a riot shield taller than a man, a helmet's dome over its rim, a baton raised behind it, a thread caught
// on the rim. Three: two more rims stand behind it, offset (Josh's lantern and Leon's van light come as hands).
// The wall: the three rims locked side by side and knelt, low and wide, the domes in a row
function shield(P) {
  const { g, V, F, I, bx, by, H, w, ink, s, act, light } = P, wall = I.look === "wall", three = I.look === "three";
  const one = (x, y, h, ww, v) => {
    poly(g, [[x - ww, y], [x + ww, y], [x + ww * 0.92, y - h], [x, y - h - ww * 0.35], [x - ww * 0.92, y - h]], v);
    g.strokeStyle = gray(0.55 + 0.3 * light); g.lineWidth = 2; g.beginPath(); g.moveTo(x - ww * 0.92, y - h); g.lineTo(x, y - h - ww * 0.35); g.lineTo(x + ww * 0.92, y - h); g.stroke();
    oval(g, x, y - h - ww * 0.55, ww * 0.55, ww * 0.42, v);
  };
  if (wall) {
    for (const k of [-1, 0, 1]) { const x = bx + k * w * 1.9; one(x, by, H * 0.62, w * 0.95, ink); poly(g, [[x - w * 0.75, by - 3], [x + w * 0.75, by - 3], [x + w * 0.7, by - H * 0.58], [x - w * 0.7, by - H * 0.58]], 0.8 * (0.75 + 0.25 * light)); }
    feat(V, "wall", { box: [bx - w * 2.9, by - H * 0.62, w * 5.8, H * 0.62] });
    tip(V, F, bx + s * w * 2.9, by - H * 0.4); return;
  }
  if (three) for (const k of [-1, 1]) one(bx + k * w * 1.25, by - 5, H * 0.92, w * 0.85, Math.min(0.2, ink * 2.4));
  one(bx, by, H * 0.95, w * 1.05, ink);
  const hand = [bx + s * w * 0.9, by - H * 0.95], bt = [hand[0] + s * w * (0.6 + 0.8 * act), hand[1] - w * (1.4 - 1.6 * act)];
  limb(g, [hand, bt], 6, 5, 0.03); limb(g, [hand, bt], 3, 3, 0.82 * (0.7 + 0.3 * light));
  // the thread hangs from the rim down the shield's dark face, where it reads
  const t0 = [bx - w * 0.62, by - H * 0.93], t1 = [bx - w * 0.5, by - H * 0.62];
  g.strokeStyle = gray(0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(...t0); g.lineTo(...t1); g.stroke();
  feat(V, "thread", { seg: [...t0, ...t1], w: 2 });
  feat(V, "baton", { seg: [...hand, ...bt], w: 3 });
  tip(V, F, bt[0], bt[1]);
}

// a hand of the line: a tall thin post with a lamp box at the top, its glass pale (Josh's road-post lantern; Leon's
// van light is the same shape with a wider glass)
function lantern(P) {
  const { g, V, F, bx, by, H, w, ink, light, s } = P, wide = hash(F.id.length, 7) > 0.5;
  g.fillStyle = gray(ink); g.fillRect(bx - 2, by - H * 1.05, 4, H * 1.05);
  const lw = wide ? w * 1.1 : w * 0.6, lh = w * 0.8, top = by - H * 1.05 - lh;
  g.fillStyle = gray(ink); g.fillRect(bx - lw / 2 - 2, top - 2, lw + 4, lh + 4);
  g.fillStyle = gray(0.85 * (0.7 + 0.3 * light)); g.fillRect(bx - lw / 2, top, lw, lh);
  feat(V, "lamp", { box: [bx - lw / 2, top, lw, lh] });
  tip(V, F, bx + s * lw, top + lh);
}

// Everybody Says: a crier's tin speaking-horn, tilted, its mouth to the player, floating at a man's head height over
// its own shadow, no body (the weighted-devices pass, 2026-10-23: it was a sheet in notice type, a document; the rumour
// is a voice). The heads: a fan of glass screens round it, each a pale lit rectangle. The verge: the horns go down
// into the ground, a low mound with their rims standing out of it
function horn(P) {
  const { g, V, F, I, bx, by, H, w, ink, s, act, light } = P, look = I.look || "base";
  oval(g, bx, by - 1, w * 1.1, w * 0.32, 0.03, 0.6);
  if (look === "verge") {
    oval(g, bx, by - w * 0.35, w * 2.2, w * 0.65, ink); oval(g, bx, by - w * 0.45, w * 1.9, w * 0.45, 0.58 * (0.7 + 0.3 * light));
    for (let k = 0; k < 5; k++) { const x = bx + (k - 2) * w * 0.8, h = w * (0.4 + 0.4 * hash(k, 9)); oval(g, x + s * 3, by - w * 0.5 - h, w * 0.32, w * 0.2, 0.88 * (0.7 + 0.3 * light)); oval(g, x + s * 3, by - w * 0.5 - h, w * 0.2, w * 0.12, 0.05); }
    feat(V, "verge", { box: [bx - w * 2.2, by - w * 1.4, w * 4.4, w * 1.4] });
    tip(V, F, bx + s * w * 2, by - w * 0.6); return;
  }
  const cy = by - H * 0.72 - 4 * act, sw = w * 1.6, sh = w * 1.1, sk = s * w * 0.55;
  // the horn: a cone from a narrow mouthpiece behind to a wide bell facing the player, a dark throat in the bell
  const back = bx - s * sw, front = bx + s * sw * 0.8;
  poly(g, [[back, cy - sh * 0.18], [front, cy - sh + sk * 0.2], [front, cy + sh + sk * 0.2], [back, cy + sh * 0.18]], 0.74 * (0.6 + 0.4 * light));
  g.fillStyle = gray(0.06); g.fillRect(Math.min(back, front), cy - 1, Math.abs(front - back), 2); // the seam down its length
  oval(g, front, cy + sk * 0.2, w * 0.38, sh, 0.82 * (0.6 + 0.4 * light)); oval(g, front, cy + sk * 0.2, w * 0.26, sh * 0.78, 0.04);
  poly(g, [[back - s * w * 0.35, cy - sh * 0.12], [back, cy - sh * 0.18], [back, cy + sh * 0.18], [back - s * w * 0.35, cy + sh * 0.12]], 0.3);
  feat(V, "horn", { box: [bx - sw - Math.abs(sk), cy - sh, sw * 2 + Math.abs(sk) * 2, sh * 2] });
  if (look === "screens") for (let k = 0; k < 4; k++) {
    const a = -Math.PI * (0.15 + 0.23 * k), x = bx + Math.cos(a) * w * 2.4, y = cy + Math.sin(a) * w * 1.3, r = w * 0.5;
    g.fillStyle = gray(0.04); g.fillRect(x - r - 1, y - r * 0.7 - 1, r * 2 + 2, r * 1.4 + 2);
    g.fillStyle = gray(0.9 * (0.7 + 0.3 * light)); g.fillRect(x - r, y - r * 0.7, r * 2, r * 1.4);
  }
  tip(V, F, bx + s * sw, cy + sh);
}

// a head of the rumour: a small lit screen on a stalk of cable, low to the ground, no face in it
function head(P) {
  const { g, V, F, bx, by, w, light, s } = P, r = w * 0.55, y = by - w * 1.7;
  limb(g, [[bx, by], [bx + s * 3, by - w * 0.8], [bx, y + r * 0.7]], 2, 1, 0.08);
  g.fillStyle = gray(0.03); g.fillRect(bx - r - 2, y - r * 0.7 - 2, r * 2 + 4, r * 1.4 + 4);
  g.fillStyle = gray(0.92 * (0.75 + 0.25 * light)); g.fillRect(bx - r, y - r * 0.7, r * 2, r * 1.4);
  feat(V, "screen", { box: [bx - r, y - r * 0.7, r * 2, r * 1.4] });
  tip(V, F, bx + s * r, y);
}

export const FORMS3 = { shield, lantern, horn, head };
