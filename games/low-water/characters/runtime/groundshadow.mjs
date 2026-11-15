// Contact shadows for every figure on a canvas, drawn once a frame into one shared mask. Each figure
// queues its footprint while it draws; after the frame's figures (a microtask, so the same task that
// drew them), the mask is built and composited under them all (destination-over), so:
//   - overlapping shadows combine by max and never stack darker where people stand together;
//   - a shadow pixel lands only where the plate's painted point is ground at the feet' height
//     (the plate's geo buffer), never on a wall, a bar front or a prop standing in front;
//   - its size is the body's footprint with a soft edge, plus a faint shadow cast away from the lamp
//     that rules the spot, laid on the same ground.
//   queueShadow(g, P, { x, y, at, ppm, r, dir, len })   P from plateCtx; dir [dx, dz] away from the lamp
import { tick, tock } from "./perf.mjs";
const queues = new Map();   // canvas context -> [footprint]
let pending = false;
const POOL = {};   // reused arrays: the masks' combined values and the images
const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const EDGE = 2, EDGE_TAPS = [[EDGE, 0], [-EDGE, 0], [0, EDGE], [0, -EDGE]], INK = [8, 4, 10], CORE = 0.55, CAST = 0.3;

export function queueShadow(g, P, fp) {
  if (!queues.has(g)) queues.set(g, []);
  queues.get(g).push({ ...fp, P });
  if (!pending) { pending = true; queueMicrotask(flush); }
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function shadeAt(fp, p0, p1, p2) {
  const dy = p1 - fp.at[1];
  if (dy > 0.12 || dy < -0.2) return 0;   // a wall, a prop or a step down: not the ground under the feet
  const dx = p0 - fp.at[0], dz = p2 - fp.at[2], B = fp.reach || (fp.reach = (fp.r + (fp.len || 0)) * 1.01 + 0.01);
  if (dx > B || dx < -B || dz > B || dz < -B) return 0;   // beyond the core and the tongue both: what the full test gives
  const d = Math.hypot(dx, dz);
  let a = CORE * (1 - smooth(fp.r * 0.7, fp.r, d));   // a flat core with a soft rim: one figure's shadow is one even tone, so only a real overlap could read darker (and max-combining forbids that)
  if (fp.dir && fp.len > 0) {   // cast away from the ruling lamp: a soft tongue that thins and fades
    const s = dx * fp.dir[0] + dz * fp.dir[1], t = -dx * fp.dir[1] + dz * fp.dir[0];
    if (s > 0 && s < fp.len) { const w = fp.r * (0.9 - 0.4 * (s / fp.len)); a = Math.max(a, CAST * (1 - s / fp.len) * (1 - smooth(w * 0.4, w, Math.abs(t)))); }
  }
  return a * (1 - smooth(0.05, 0.2, Math.max(0, dy)));
}

function flush() {
  const t = tick(); flushAll(); tock("groundshadow", t);
}

// One footprint's shadow, as the shared mask takes it: its screen box (clipped to W x H) and its mask over
// the part of the box that shades at all, box-local. Gd: the plate's cells under the screen, from
// platectx (grid) or a crop of it (gridCrop below, for a figure worker): colOf, rowOf, gw, gh, and the
// cells' validity and points indexed by ((gy - y0c) * cw + gx - x0c).
//   footprintMask(fp, Gd, W, H) -> { box, x0, y0, w, h, mask: Float32Array(w * h), stat: { cnt, nul, rej, skipped } }
export function footprintBox(fp, W, H) {
  const R = (Math.max(fp.r, fp.len || 0) + 0.1) * fp.ppm;
  return [Math.max(0, Math.floor(fp.x - R)), Math.max(0, Math.floor(fp.y - R * 0.8)), Math.min(W, Math.ceil(fp.x + R)), Math.min(H, Math.ceil(fp.y + R * 0.8))];
}
export function footprintMask(fp, Gd, W, H) {
  const box = footprintBox(fp, W, H), [bx0, by0, bx1, by1] = box; let cnt = 0, nul = 0, rej = 0;
  const POS = Gd.pos, ay = fp.at[1], gw = Gd.gw, gh = Gd.gh, valid = Gd.valid, X0c = Gd.x0c || 0, Y0c = Gd.y0c || 0, CW = Gd.cw || gw, li = (gx, gy) => (gy - Y0c) * CW + (gx - X0c);
  if (bx1 <= bx0 || by1 <= by0) return { box, x0: bx0, y0: by0, w: 0, h: 0, mask: new Float32Array(0), stat: { cnt, nul, rej, skipped: 0 } };   // a footprint off the canvas
  // the geo cell of every column and row of the box (and EDGE beyond), as pointAt finds it
  const cw = bx1 - bx0 + 2 * EDGE, ch = by1 - by0 + 2 * EDGE, cols = new Int32Array(cw), rows = new Int32Array(ch);
  for (let k = 0; k < cw; k++) { const gx = Gd.colOf(bx0 - EDGE + k + 0.5); cols[k] = gx < 0 || gx >= gw ? -1 : gx; }
  for (let k = 0; k < ch; k++) { const gy = Gd.rowOf(by0 - EDGE + k + 0.5); rows[k] = gy < 0 || gy >= gh ? -1 : gy; }
  const at = (cx, cy) => { const gx = cols[cx], gy = rows[cy]; if (gx < 0 || gy < 0) return -1; const i = li(gx, gy); return valid[i] ? i * 3 : -1; };
  // shadeAt depends only on the cell's point, and several pixels share a cell: once a cell
  let gx0 = Infinity, gx1 = -1, gy0 = Infinity, gy1 = -1;
  for (const v of cols) if (v >= 0) { if (v < gx0) gx0 = v; if (v > gx1) gx1 = v; }
  for (const v of rows) if (v >= 0) { if (v < gy0) gy0 = v; if (v > gy1) gy1 = v; }
  const cwid = Math.max(0, gx1 - gx0 + 1), cache = new Float64Array(cwid * Math.max(0, gy1 - gy0 + 1));
  // the box's columns in runs that share a geo column: in a run, a cell whose shade is exactly 0 (or no
  // cell) leaves the whole run as the per-pixel test would (each pixel rejected, the mask unchanged)
  const runEnd = new Int32Array(cw); for (let k = cw - 1; k >= 0; k--) runEnd[k] = k + 1 < cw && cols[k + 1] === cols[k] ? runEnd[k + 1] : k + 1;
  // shade every cell of the box once, and keep the box round the cells that shade at all: rows and
  // columns outside it hold only cells that shade 0 (or none), which leave the mask as it is
  let ax0 = Infinity, ax1 = -1, ay0 = Infinity, ay1 = -1;
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const i = li(gx, gy); if (!valid[i]) continue; const a0 = (cache[(gy - gy0) * cwid + (gx - gx0)] = shadeAt(fp, POS[i * 3], POS[i * 3 + 1], POS[i * 3 + 2]));
    if (a0 !== 0) { if (gx < ax0) ax0 = gx; if (gx > ax1) ax1 = gx; if (gy < ay0) ay0 = gy; if (gy > ay1) ay1 = gy; }
  }
  let sx0 = bx1, sx1 = bx0, sy0 = by1, sy1 = by0;   // the screen columns and rows whose cells lie in it
  for (let sx = bx0; sx < bx1; sx++) { const g = cols[sx - bx0 + EDGE]; if (g >= ax0 && g <= ax1) { if (sx < sx0) sx0 = sx; sx1 = sx + 1; } }
  for (let sy = by0; sy < by1; sy++) { const g = rows[sy - by0 + EDGE]; if (g >= ay0 && g <= ay1) { if (sy < sy0) sy0 = sy; sy1 = sy + 1; } }
  const mw = Math.max(0, sx1 - sx0), mh = Math.max(0, sy1 - sy0), mask = new Float32Array(mw * mh), skipped = (bx1 - bx0) * (by1 - by0) - mw * mh;
  for (let sy = sy0; sy < sy1; sy++) {
    const cy = sy - by0 + EDGE, gy = rows[cy], row = (sy - sy0) * mw - sx0;
    for (let sx = sx0; sx < sx1;) {
      const cx = sx - bx0 + EDGE, gx = cols[cx], end = Math.min(sx1, runEnd[cx] + bx0 - EDGE), len = end - sx;
      const k0 = gx < 0 || gy < 0 || !valid[li(gx, gy)] ? -1 : li(gx, gy) * 3;
      if (k0 < 0) { nul += len; sx = end; continue; }
      const a0 = cache[(gy - gy0) * cwid + (gx - gx0)];
      if (a0 === 0) { rej += len; sx = end; continue; }
      for (; sx < end; sx++) {
        const cx2 = sx - bx0 + EDGE; let a = a0;
        // eroded by EDGE px: a pixel beside a leg, a wall foot or a step edge stays clear, so a one-pixel
        // difference between this mapping and another reader's never puts shadow on the prop
        if (a > 0.01) for (let t = 0; t < 4; t++) { const q = at(cx2 + EDGE_TAPS[t][0], cy + EDGE_TAPS[t][1]); if (q < 0 || Math.abs(POS[q + 1] - ay) > 0.12) { a = 0; break; } }
        if (a > 0.01) cnt++; else rej++; mask[row + sx] = a;
      }
    }
  }
  return { box, x0: sx0, y0: sy0, w: mw, h: mh, mask, stat: { cnt, nul, rej, skipped } };
}
// The cells a footprint reads, cut from the plate's (platectx P.grid) for a worker: the same answers inside its box.
export function gridCrop(Gd, box) {
  const M = EDGE + 2, ca = Gd.colOf(box[0] - M + 0.5), cb = Gd.colOf(box[2] + M + 0.5), ra = Gd.rowOf(box[1] - M + 0.5), rb = Gd.rowOf(box[3] + M + 0.5);
  const x0c = Math.max(0, Math.min(ca, cb) - 1), x1c = Math.min(Gd.gw - 1, Math.max(ca, cb) + 1), y0c = Math.max(0, Math.min(ra, rb) - 1), y1c = Math.min(Gd.gh - 1, Math.max(ra, rb) + 1);
  const cw = Math.max(1, x1c - x0c + 1), ch = Math.max(1, y1c - y0c + 1), pos = new Float32Array(cw * ch * 3), valid = new Uint8Array(cw * ch);
  if (x1c >= x0c) for (let y = 0; y < ch && y0c + y <= y1c; y++) { const g = (y0c + y) * Gd.gw + x0c; pos.set(Gd.pos.subarray(g * 3, (g + cw) * 3), y * cw * 3); valid.set(Gd.valid.subarray(g, g + cw), y * cw); }
  return { left: Gd.left, top: Gd.top, zoom: Gd.zoom, s: Gd.s, gw: Gd.gw, gh: Gd.gh, x0c, y0c, cw, pos, valid };
}
// a crop's colOf and rowOf (platectx's own formula, from the numbers the crop carries)
export const withLookups = (C) => ({ ...C, colOf: (sx) => Math.floor((C.left + sx / C.zoom) * C.s), rowOf: (sy) => Math.floor((C.top + sy / C.zoom) * C.s) });

// a footprint worked out elsewhere (a figure worker): its mask, placed with a shift (the figure's feet now
// against where they were when its frame was sent)
export function queueMask(g, fm, dx = 0, dy = 0) {
  if (!queues.has(g)) queues.set(g, []);
  queues.get(g).push({ done: fm, dx, dy });
  if (!pending) { pending = true; queueMicrotask(flush); }
}

function flushAll() {
  pending = false;
  for (const [g, list] of queues) {
    queues.delete(g);
    if (!list.length) continue;
    const W = g.canvas.width, H = g.canvas.height;
    let tg = tick();
    // every footprint's mask: worked out here from the plate, or as a worker sent it
    const fms = list.map((fp) => (fp.done ? { ...fp.done, x0: fp.done.x0 + Math.round(fp.dx), y0: fp.done.y0 + Math.round(fp.dy) } : { ...footprintMask(fp, fp.P.grid, W, H), at: fp.at }));
    tock("gs.footprints", tg); tg = tick();
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const m of fms) if (m.w && m.h) { x0 = Math.min(x0, m.x0); y0 = Math.min(y0, m.y0); x1 = Math.max(x1, m.x0 + m.w); y1 = Math.max(y1, m.y0 + m.h); }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    const per = fms.map((m) => ({ at: (m.at || []).map((v) => +v.toFixed(2)), box: m.box, ...m.stat }));
    if (x1 <= x0 || y1 <= y0) { globalThis.__lwShadowStats = { per, figures: list.length, pixels: 0, peak: 0, box: [0, 0, 0, 0] }; continue; }
    // max-combined (overlapping shadows never stack darker), in clusters: masks whose rectangles overlap are
    // combined together, and each cluster goes up as its own image. The pixels are those of one image over
    // the union (outside every cluster that image is transparent, and a transparent pixel drawn under the
    // figures changes nothing), without filling and uploading the empty space between figures far apart.
    const ink = globalThis.__lwShadowDebug ? [255, 0, 255] : INK, amp = globalThis.__lwShadowDebug ? 2 : 1;   // the debug colour shows where the mask lands
    const R = [];   // each mask's rectangle inside the union, or null
    for (const m of fms) { const a = Math.max(x0, m.x0), b = Math.max(y0, m.y0), c = Math.min(x1, m.x0 + m.w), d = Math.min(y1, m.y0 + m.h); R.push(m.w && m.h && c > a && d > b ? [a, b, c, d] : null); }
    const up = R.map((_, k) => k), root = (k) => { while (up[k] !== k) k = up[k] = up[up[k]]; return k; };
    for (let a = 0; a < R.length; a++) if (R[a]) for (let b = a + 1; b < R.length; b++) if (R[b] && R[a][0] < R[b][2] && R[b][0] < R[a][2] && R[a][1] < R[b][3] && R[b][1] < R[a][3]) up[root(a)] = root(b);
    const clusters = new Map(); R.forEach((r, k) => { if (!r) return; const q = root(k); let C = clusters.get(q); if (!C) clusters.set(q, (C = { box: [...r], ms: [] })); else { C.box[0] = Math.min(C.box[0], r[0]); C.box[1] = Math.min(C.box[1], r[1]); C.box[2] = Math.max(C.box[2], r[2]); C.box[3] = Math.max(C.box[3], r[3]); } C.ms.push(k); });
    let peak = 0, hits = 0; const ups = [];
    for (const C of clusters.values()) {
      const [cx0, cy0, cx1, cy1] = C.box, w = cx1 - cx0, h = cy1 - cy0, mask = POOL.mask && POOL.mask.length >= w * h ? POOL.mask : (POOL.mask = new Float32Array(w * h));
      mask.fill(0, 0, w * h);
      let mx0 = w, my0 = h, mx1 = -1, my1 = -1;
      for (const k of C.ms) { const m = fms[k], mw = m.w, mh = m.h, mX = m.x0 - cx0, mY = m.y0 - cy0, mm = m.mask;
        const xa = Math.max(0, -mX), xb = Math.min(mw, w - mX);
        for (let yy = Math.max(0, -mY), ye = Math.min(mh, h - mY); yy < ye; yy++) { const Y = mY + yy, row = yy * mw, out = Y * w + mX;
          for (let xx = xa; xx < xb; xx++) { const v = mm[row + xx], o = mask[out + xx]; if (v > o) { mask[out + xx] = v; if (v > 0.01 && !(o > 0.01)) hits++; if (v > peak) peak = v; if (Math.round(Math.min(1, v * amp) * 255)) { const X = mX + xx; if (X < mx0) mx0 = X; if (X > mx1) mx1 = X; if (Y < my0) my0 = Y; if (Y > my1) my1 = Y; } } } } }
      if (mx1 < 0) continue;
      // only the rectangle round the cluster's pixels with alpha goes up
      // (into one of a pool of images kept frame to frame: a new image for each cluster each frame cost more
      // than the pass itself in a Node measure)
      const ww = mx1 - mx0 + 1, hh = my1 - my0 + 1, imgs = (POOL.imgs ||= []), ui = ups.length;
      let img = imgs[ui]; if (!img || img.width < ww || img.height < hh) img = imgs[ui] = new ImageData(Math.max(ww, img ? img.width : 0), Math.max(hh, img ? img.height : 0));
      const d = img.data, IW = img.width;
      if (LE) {   // a pixel in one 32-bit write (the same bytes as the four below on a little-endian machine)
        const d32 = img.d32 || (img.d32 = new Uint32Array(d.buffer, d.byteOffset, d.length >> 2)), rgb = ink[0] | (ink[1] << 8) | (ink[2] << 16);
        for (let yy = 0; yy < hh; yy++) { const row = yy * IW, src = (yy + my0) * w + mx0; for (let xx = 0; xx < ww; xx++) d32[row + xx] = (rgb | (Math.round(Math.min(1, mask[src + xx] * amp) * 255) << 24)) >>> 0; }
      } else for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < ww; xx++) { const o = (yy * IW + xx) * 4; d[o] = ink[0]; d[o + 1] = ink[1]; d[o + 2] = ink[2]; d[o + 3] = Math.round(Math.min(1, mask[(yy + my0) * w + xx + mx0] * amp) * 255); }
      ups.push({ img, w: ww, h: hh, x: cx0 + mx0, y: cy0 + my0 });
    }
    globalThis.__lwShadowStats = { per, figures: list.length, pixels: hits, peak: +peak.toFixed(3), box: [x0, y0, x1 - x0, y1 - y0], combined: fms.reduce((a, m) => a + m.w * m.h, 0), uploaded: ups.reduce((a, u) => a + u.w * u.h, 0), clusters: ups.length };   // read by characters/proto/plate_proof.py
    tock("gs.pass", tg); tg = tick();
    if (!ups.length) continue;
    // the clusters side by side on one scratch canvas, each drawn from its own rectangle
    const SW = ups.reduce((a, u) => a + u.w, 0), SH = ups.reduce((a, u) => Math.max(a, u.h), 0);
    const c = (flush.scratch ||= new OffscreenCanvas(8, 8)); if (c.width < SW || c.height < SH) { c.width = Math.max(c.width, SW); c.height = Math.max(c.height, SH); }
    const cg = c.getContext("2d"); let sx = 0; for (const u of ups) { u.sx = sx; cg.putImageData(u.img, sx, 0, 0, 0, u.w, u.h); sx += u.w; }
    tock("gs.image", tg); tg = tick();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-over";
    for (const u of ups) g.drawImage(c, u.sx, 0, u.w, u.h, u.x, u.y, u.w, u.h);
    g.restore(); tock("gs.draw", tg);
  }
}
