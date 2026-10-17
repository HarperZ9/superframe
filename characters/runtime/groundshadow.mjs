// Contact shadows for every figure on a canvas, drawn once a frame into one shared mask. Each figure
// queues its footprint while it draws; after the frame's figures (a microtask, so the same task that
// drew them), the mask is built and composited under them all (destination-over), so:
//   - overlapping shadows combine by max and never stack darker where people stand together;
//   - a shadow pixel lands only where the plate's painted point is ground at the feet' height
//     (the plate's geo buffer), never on a wall, a bar front or a prop standing in front;
//   - its size is the body's footprint with a soft edge, plus a faint shadow cast away from the lamp
//     that rules the spot, laid on the same ground.
//   queueShadow(g, P, { x, y, at, ppm, r, dir, len })   P from plateCtx; dir [dx, dz] away from the lamp
const queues = new Map();   // canvas context -> [footprint]
let pending = false;
const INK = [8, 4, 10], CORE = 0.55, CAST = 0.3;

export function queueShadow(g, P, fp) {
  if (!queues.has(g)) queues.set(g, []);
  queues.get(g).push({ ...fp, P });
  if (!pending) { pending = true; queueMicrotask(flush); }
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function shadeAt(fp, p) {
  const dy = p[1] - fp.at[1];
  if (dy > 0.12 || dy < -0.2) return 0;   // a wall, a prop or a step down: not the ground under the feet
  const dx = p[0] - fp.at[0], dz = p[2] - fp.at[2], d = Math.hypot(dx, dz);
  let a = CORE * (1 - smooth(fp.r * 0.7, fp.r, d));   // a flat core with a soft rim: one figure's shadow is one even tone, so only a real overlap could read darker (and max-combining forbids that)
  if (fp.dir && fp.len > 0) {   // cast away from the ruling lamp: a soft tongue that thins and fades
    const s = dx * fp.dir[0] + dz * fp.dir[1], t = -dx * fp.dir[1] + dz * fp.dir[0];
    if (s > 0 && s < fp.len) { const w = fp.r * (0.9 - 0.4 * (s / fp.len)); a = Math.max(a, CAST * (1 - s / fp.len) * (1 - smooth(w * 0.4, w, Math.abs(t)))); }
  }
  return a * (1 - smooth(0.05, 0.2, Math.max(0, dy)));
}

function flush() {
  pending = false;
  for (const [g, list] of queues) {
    queues.delete(g);
    if (!list.length) continue;
    const W = g.canvas.width, H = g.canvas.height;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const fp of list) {   // screen bounds of each footprint (its reach in metres at its scale)
      const R = (Math.max(fp.r, fp.len || 0) + 0.1) * fp.ppm;
      fp.box = [Math.max(0, Math.floor(fp.x - R)), Math.max(0, Math.floor(fp.y - R * 0.8)), Math.min(W, Math.ceil(fp.x + R)), Math.min(H, Math.ceil(fp.y + R * 0.8))];
      x0 = Math.min(x0, fp.box[0]); y0 = Math.min(y0, fp.box[1]); x1 = Math.max(x1, fp.box[2]); y1 = Math.max(y1, fp.box[3]);
    }
    if (x1 <= x0 || y1 <= y0) continue;
    const w = x1 - x0, h = y1 - y0, mask = new Float32Array(w * h);
    const per = [];
    for (const fp of list) {
      const [bx0, by0, bx1, by1] = fp.box; let cnt = 0, nul = 0, rej = 0;
      for (let sy = by0; sy < by1; sy++) for (let sx = bx0; sx < bx1; sx++) {
        const p = fp.P.pointAt(sx + 0.5, sy + 0.5); if (!p) { nul++; continue; }
        const a = shadeAt(fp, p), k = (sy - y0) * w + (sx - x0); if (a > 0.01) cnt++; else rej++; if (a > mask[k]) mask[k] = a;
      }
      per.push({ at: fp.at.map((v) => +v.toFixed(2)), box: fp.box, cnt, nul, rej });
    }
    let peak = 0, hits = 0; for (const v of mask) { if (v > 0.01) hits++; if (v > peak) peak = v; }
    globalThis.__lwShadowStats = { per, figures: list.length, pixels: hits, peak: +peak.toFixed(3), box: [x0, y0, w, h] };   // read by characters/proto/plate_proof.py
    const img = new ImageData(w, h), d = img.data;
    const ink = globalThis.__lwShadowDebug ? [255, 0, 255] : INK, amp = globalThis.__lwShadowDebug ? 2 : 1;   // the debug colour shows where the mask lands
    for (let k = 0; k < mask.length; k++) { d[k * 4] = ink[0]; d[k * 4 + 1] = ink[1]; d[k * 4 + 2] = ink[2]; d[k * 4 + 3] = Math.round(Math.min(1, mask[k] * amp) * 255); }
    const c = (flush.scratch ||= new OffscreenCanvas(8, 8)); c.width = w; c.height = h; c.getContext("2d").putImageData(img, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-over"; g.drawImage(c, x0, y0); g.restore();
  }
}
