// What the drawer does to a rendered figure before it goes on the screen, as one pure function so
// the drawer runs it on its own thread and a figure worker (runtime/figworker.mjs) runs it the same:
// exposure to the painting around the feet, the occlusion test against the painted room (with a one
// pixel feather), the face lift and Oil and Ink shade, the brush painter, the brightness cap (R4),
// the ink line on the silhouette and the ghost of a hidden Lamb or foe.
//   const out = finishFigure(r, P, buf, d)   r from renderJob; d the image's bytes (zeroed), written in place
//   P: { ss, stats, sur, look (Set), seated, depth, at, fw, depthAt(sx, sy, floorY) | null, ox, oy, solo,
//        keepDepth, who, team, person, painter | null, paintInfo, truePpm, yawDeg }
//   out: { gain, ceil, vis, dbg, paintStats }
import { exposure } from "./expose.mjs";
import { oilInk, INK_RGB, inkWidth } from "./oilink.mjs";
import { MATS } from "../rig/materials.mjs";
import { tick, tock } from "./perf.mjs";

export const CAP_X = 1.9;   // linear: about 1.34x in display values
export const LINB = Float32Array.from({ length: 256 }, (_, i) => { const v = i / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
export const ENCB = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.min(1, v) ** (1 / 2.4) - 0.055));
export const LIFT_IDS = new Set(["skin", "cheek", "jawcool", "lip"].map((n) => MATS[n].id));
export const SEAT_SLACK = 0.22, LIFT = 1.25, OCC_BIAS = 0.14;   // occlusion slack in metres; face lift in linear light
const oilFor = {};

export function finishFigure(r, P, pb, d) {
  const { ss, stats, sur, look, seated, depth, at, fw, depthAt, ox, oy, truePpm } = P, G = r.G, n = r.w * r.h;
  let t = tick();
    // a band (P.band [y0, y1), a figure split over workers): first only its samples for the median; then,
    // given the median (P.irr), its rows' occlusion (a row more each side, for the feather) and shade
    const B = P.band, own = B ? [B[0] * r.w, B[1] * r.w] : null;
    const X = exposure(r.rgba, n, stats, r.albedo, (i) => ((i / r.w) | 0) * ss * G.w + (i % r.w) * ss, pb, B ? (P.irr === undefined ? { range: own } : { irr: P.irr }) : {});
    if (B && P.irr === undefined) return { samples: X.samples || new Float64Array(0) };
    const occRows = B ? [Math.max(0, B[0] - 1), Math.min(r.h, B[1] + 1)] : [0, r.h], shadeRows = B ? B : [0, r.h];
    // hidden where the painted room stands in front: each pixel's own depth against the painting's
    // (OCC_BIAS of slack for the geo buffer's half resolution), a hard mask first, then a one-pixel
    // feather at its edge, so a figure behind a post or a counter is cut cleanly and never ghosted;
    // props in the hands go through the same test
    tock("expose", t); t = tick();
    const vis = (pb.vis && pb.vis.length === n ? pb.vis : (pb.vis = new Uint8Array(n))).fill(1), dbg = P.keepDepth ? new Float32Array(n).fill(NaN) : null;
    // each figure pixel's depth along the camera's forward axis (metres, the plate's depthOf scale):
    // kept for args.solo (the visual check compares true depths) and the debug flag
    const dzAt = (px, py) => { const gi = py * ss * G.w + px * ss; return G.id[gi] && at ? (depth ?? 0) + (G.wp[gi * 3] - at[0]) * fw[0] + (G.wp[gi * 3 + 1] - at[1]) * fw[1] + (G.wp[gi * 3 + 2] - at[2]) * fw[2] : NaN; };
    if (dbg && !(depthAt && depth != null)) for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) { const i = py * r.w + px; if (r.rgba[i * 4 + 3] > 0) dbg[i] = dzAt(px, py); }
    // a seated body leans into its chair: its back is within centimetres of the painted chair back, and the
    // test flickered in geo-cell steps (Keel in the harbour office). Seated, the figure is tested as if
    // SEAT_SLACK further back, so the chair's back hides the body behind it cleanly
    const seatSlack = seated ? SEAT_SLACK : 0;
    if (depthAt && depth != null) for (let py = occRows[0]; py < occRows[1]; py++) for (let px = 0; px < r.w; px++) {
      const i = py * r.w + px; if (r.rgba[i * 4 + 3] <= 0) continue;
      const gi = py * ss * G.w + px * ss, dz = G.id[gi] && at ? depth + (G.wp[gi * 3] - at[0]) * fw[0] + (G.wp[gi * 3 + 1] - at[1]) * fw[1] + (G.wp[gi * 3 + 2] - at[2]) * fw[2] : depth;
      if (dbg) dbg[i] = dz;
      if (dz + seatSlack - depthAt(ox + px, oy + py, at ? at[1] : undefined) > OCC_BIAS) vis[i] = 0;
    }
    tock("occlude", t); t = tick();
    const oil = look.has("oil") ? (oilFor[P.yawDeg] ||= oilInk({ yawDeg: P.yawDeg })) : null, lifts = look.has("lift"), c3 = [0, 0, 0], rgbaF = r.rgba, rw = r.w, rh = r.h;
    for (let py = shadeRows[0]; py < shadeRows[1]; py++) for (let px = 0; px < rw; px++) {
      const i = py * rw + px; let al = rgbaF[i * 4 + 3]; if (al <= 0 || !vis[i]) continue;
      let s9 = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X2 = px + dx, Y2 = py + dy; s9 += X2 < 0 || Y2 < 0 || X2 >= rw || Y2 >= rh ? 1 : vis[Y2 * rw + X2]; }
      al *= Math.min(1, s9 / 7);
      const lift = lifts && LIFT_IDS.has(G.id[py * ss * G.w + px * ss]) ? LIFT : 1;   // faces and hands catch the light, under the ceiling
      let c = X.applyTo(i, lift, c3); if (oil) { const gi = py * ss * G.w + px * ss; c = oil.shade(c, [G.N[gi * 3], G.N[gi * 3 + 1], G.N[gi * 3 + 2]], lift !== 1, X.ceil); } d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = Math.round(al * 255);
    }
    // the brush painter (game/engine/paint), the same in every mode: strokes in the figure's bind space
    tock("shade", t); t = tick();
    if (P.verify) { let hsh = 2166136261; for (let i = 0; i < d.length; i++) hsh = Math.imul(hsh ^ d[i], 16777619); for (let i = 0; i < G.loc.length; i += 7) hsh = Math.imul(hsh ^ (G.loc[i] * 1e6 | 0), 16777619); P.preHash = hsh >>> 0; }   // the verify mode compares threads before the painter
  if (P.split) return { X: { gain: X.gain, ceil: X.ceil }, vis, dbg, seatSlack, preHash: P.preHash };   // the painting runs elsewhere (postFigure)
  return postFigure(r, P, pb, d, { X, vis, dbg, dzAt, seatSlack, t });
}

// The second half (the painter and what follows it), apart so a figure's painting can run in its own
// worker while the next frame's first half runs in another (runtime/figworker.mjs, stage "paint").
// A: { X: { gain, ceil }, vis, dbg, dzAt, seatSlack } from the first half; r: { w, h, G, rgba } where only
// rgba's alpha is read
export function postFigure(r, P, pb, d, A) {
  const { ss, stats, sur, look, depth, at, fw, depthAt, ox, oy, truePpm } = P, G = r.G, n = r.w * r.h, { X, vis, dbg, seatSlack } = A;
  const dzAt = A.dzAt || ((px, py) => { const gi = py * ss * G.w + px * ss; return G.id[gi] && at ? (depth ?? 0) + (G.wp[gi * 3] - at[0]) * fw[0] + (G.wp[gi * 3 + 1] - at[1]) * fw[1] + (G.wp[gi * 3 + 2] - at[2]) * fw[2] : NaN; });
  const alphaAt = r.alpha ? (i) => r.alpha[i] : (i) => r.rgba[i * 4 + 3];   // a painting worker gets the alpha alone
  let t = A.t != null ? A.t : tick();
    if (P.painter) P.paintStats = P.painter.paint(d, r.w, r.h, G, ss, { ...P.paintInfo, depth, ox, oy, at, ground: sur ? sur.mid : stats ? stats.mid : null });
    // a hard guard on R4 ("no figure brighter than the lamp pool it stands in"): the figure's median
    // luminance is held under CAP_X (in display terms, about a third of a stop) of the painting round it.
    // A pale back turned to the camera under the carried light read twice the room (Merrow, 2026-10-21)
    tock("painter", t); t = tick();
    if (sur) {
      const yb = pb.ys && pb.ys.length >= (n + 1) >> 1 ? pb.ys : (pb.ys = new Float64Array((n + 1) >> 1)); let ny = 0;
      for (let i = 0; i < n; i += 2) if (d[i * 4 + 3] > 200) yb[ny++] = 0.2126 * LINB[d[i * 4]] + 0.7152 * LINB[d[i * 4 + 1]] + 0.0722 * LINB[d[i * 4 + 2]];
      if (ny > 20) { const ys = yb.subarray(0, ny).sort(); const m = ys[ny >> 1], lim = CAP_X * Math.max(sur.mid, 0.004); if (m > lim) { const k = lim / m; for (let i = 0; i < n; i++) if (d[i * 4 + 3]) for (let c = 0; c < 3; c++) d[i * 4 + c] = ENCB(LINB[d[i * 4 + c]] * k); } }
    }
    tock("cap", t); t = tick();
    if (look.has("outline")) {   // the plates' violet-brown ink on the silhouette (LOOK-UNIFIED R3), never a pale halo (R4)
      const src = (pb.src && pb.src.length === d.length ? pb.src : (pb.src = new Uint8ClampedArray(d.length))), wpx = inkWidth(truePpm), W1 = r.w + 1;
      src.set(d);
      // a summed-area table of the opaque (over 200) pixels: a pixel with none in the box wpx round it
      // cannot find one in the disc, so it skips the search (the same lines, found without the scan)
      const S = pb.sat && pb.satW === W1 && pb.sat.length === W1 * (r.h + 1) ? pb.sat : (pb.satW = W1, pb.sat = new Int32Array(W1 * (r.h + 1)));   // a new table when the width changes (row 0 and column 0 stay zero)
      for (let py = 0; py < r.h; py++) { let row = 0; for (let px = 0; px < r.w; px++) { row += src[(py * r.w + px) * 4 + 3] > 200 ? 1 : 0; S[(py + 1) * W1 + px + 1] = S[py * W1 + px + 1] + row; } }
      for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) { const i = py * r.w + px; if (src[i * 4 + 3] > 40) continue; let hit = 0, hx = 0, hy = 0;
        { const xa = px - wpx < 0 ? 0 : px - wpx, xb = px + wpx >= r.w ? r.w : px + wpx + 1, ya = py - wpx < 0 ? 0 : py - wpx, yb2 = py + wpx >= r.h ? r.h : py + wpx + 1;
          if (S[yb2 * W1 + xb] - S[ya * W1 + xb] - S[yb2 * W1 + xa] + S[ya * W1 + xa] === 0) continue; }
        for (let dy = -wpx; dy <= wpx && !hit; dy++) for (let dx = -wpx; dx <= wpx; dx++) { if (dx * dx + dy * dy > wpx * wpx + 0.5) continue; const X2 = px + dx, Y2 = py + dy; if (X2 < 0 || Y2 < 0 || X2 >= r.w || Y2 >= r.h) continue; if (src[(Y2 * r.w + X2) * 4 + 3] > 200) { hit = src[(Y2 * r.w + X2) * 4 + 3]; hx = X2; hy = Y2; break; } }
        // never ink a cut edge: where the painting stands in front of the line, it stays the painting's
        if (hit && depthAt && depth != null) { const dzN = dzAt(hx, hy); if (dzN === dzN && dzN + seatSlack - depthAt(ox + px, oy + py, at ? at[1] : undefined) > OCC_BIAS) hit = 0; }
        if (hit) { d[i * 4] = INK_RGB[0]; d[i * 4 + 1] = INK_RGB[1]; d[i * 4 + 2] = INK_RGB[2]; d[i * 4 + 3] = 245; } }   // solid ink, as the plates draw it
    }
    // Lamb's edge through figures drawn over Lamb: in fights only, where losing Lamb behind a foe costs
    // a blow; walking and talking keep R4 (the player is never outlined)
    // No outline in any mode (the reference has none). A body the painting hides is shown as a flat
    // silhouette at 30% instead: Lamb a dim teal everywhere, a foe red in a fight (spec section 1.3)
    const ghost = P.solo ? null : P.who === "lamb" || P.team === "lamb" ? [52, 92, 96] : !P.person ? [196, 64, 52] : null;
    if (ghost) for (let i = 0; i < n; i++) if (!vis[i] && alphaAt(i) > 128 && d[i * 4 + 3] === 0) { d[i * 4] = ghost[0]; d[i * 4 + 1] = ghost[1]; d[i * 4 + 2] = ghost[2]; d[i * 4 + 3] = 77; }
  tock("outline", t);
  return { gain: X.gain, ceil: X.ceil, vis, dbg, paintStats: P.paintStats || null, preHash: P.preHash };
}
