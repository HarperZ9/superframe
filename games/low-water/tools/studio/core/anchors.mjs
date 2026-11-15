// Where the eyes are, from the head's construction rather than the picture. The Quota heads (cast/parts.mjs
// head()) sit the eyes at fixed points of the head's own frame, and heavy lids can hide them entirely,
// so the render alone cannot find them. Each rendered pixel knows its rest-pose point (G.loc); the eye's
// rest-pose centre is found in the same frame, and the pixels near it give its place and size on canvas.
// An eye with too few pixels near it is turned away (behind the nose) and reported hidden.
//   eyeAnchors(C, G) -> [{ cx, cy, rx, ry, iris: [x, y], hidden }]   (sorted left to right on canvas)
import { bind, INDEX } from "../../../characters/rig/body.mjs";
import { game } from "./game.mjs";

// the head's construction comes from the game's config (head.radius(P), head.eye in radii); a game without one
// gets no anchors and the landmarks fall back to the eyes the render shows
export const headRadius = (P) => game().head.radius(P);

export function eyeAnchors(C, G) {
  if (!game().head) return [];
  const EYE = game().head.eye, B = bind(C.P), hd = B[INDEX.head].p, R = headRadius(C.P), c = [hd[0], hd[1] + R * 0.9, hd[2] + R * 0.05], out = [];
  for (const side of [-1, 1]) {
    const e = [c[0] + side * EYE.x * R, c[1] + EYE.y * R, c[2] + EYE.z * R];
    let best = -1, bd = Infinity, n = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < G.w * G.h; i++) {
      if (!G.id[i]) continue;
      const d = Math.hypot(G.loc[i * 3] - e[0], G.loc[i * 3 + 1] - e[1], G.loc[i * 3 + 2] - e[2]);
      if (d < bd) { bd = d; best = i; }
      if (d < 0.17 * R) { n++; const x = i % G.w, y = (i / G.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    if (best < 0) continue;
    const cx = best % G.w, cy = (best / G.w) | 0, hidden = n < 12 || bd > 0.1 * R;
    // the opening: about two fifths of the eye's width
    out.push({ cx, cy, rx: n ? Math.max(3, (x1 - x0) / 2) : 3, ry: n ? Math.max(2, ((x1 - x0) / 2) * 0.4) : 2, iris: [cx, cy], hidden, n });
  }
  return out.sort((a, b) => a.cx - b.cx);
}
