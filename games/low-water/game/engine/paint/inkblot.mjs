// Ink-blot transitions (the author's reference: an ink mask spreading over paper between places, and for
// fainting). A blot of the Daybook's ink grows from a point over the view, its edge ragged as ink takes to paper
// (a fixed field of value noise, so each blot has its own coast and spreads along its fibres), covers, and
// then draws back off the new scene. Drawn at half size on its own canvas, the edge kept hard.
//   const T = inkBlots(host); await T.cover({ at: [x, y] in 0..1, ms }); T.reveal({ ms }); T.faint() (cover, hold, reveal slowly)
//   globalThis.__lwInkBlot: the same object, for the story and the systems (fainting, a scene cut)
const INK = [26, 18, 22];
function field(w, h, seed) {
  // value noise in three octaves, plus a grain, 0..1: where it is low, the ink reaches first
  const f = new Float32Array(w * h); let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const [cell, amp] of [[48, 0.55], [17, 0.3], [5, 0.15]]) {
    const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = Float32Array.from({ length: gw * gh }, rnd);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
      f[y * w + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
    }
  }
  return f;
}
// The same field made a few rows at a time (each pixel's three octaves added in the same order, from the
// same random grids), so it can be made ahead in slices of a few milliseconds instead of on the first
// frame of a move (design/state/perf.md); step() does about `rows` rows and returns true when done.
function fieldSteps(w, h, seed) {
  const f = new Float32Array(w * h); let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const oct = [[48, 0.55], [17, 0.3], [5, 0.15]].map(([cell, amp]) => { const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2; return { cell, amp, gw, g: Float32Array.from({ length: gw * gh }, rnd) }; });
  let y = 0;
  return { f, step(rows) {
    for (const y1 = Math.min(h, y + rows); y < y1; y++) for (const { cell, amp, gw, g } of oct) for (let x = 0; x < w; x++) {
      const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
      f[y * w + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
    }
    return y >= h;
  } };
}
// each pixel's arrival from a start at (fraction of the view), as run() makes it
function arrivals(F, w, h, at) {
  const cx = at[0] * w, cy = at[1] * h, R = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)), T = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; T[i] = Math.min(1, (Math.hypot(x - cx, y - cy) / R) * 0.7 + F[i] * 0.42); }
  return T;
}
export function inkBlots(host) {
  const cv = document.createElement("canvas"); cv.className = "inkblot"; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:30;image-rendering:auto";
  host.append(cv); cv.hidden = true;
  let seed = 7, F = null, raf = 0, pre = null, Tk = null;
  // made ahead, in slices of a few milliseconds, for the view's size and the next seed: the field, and the
  // arrivals from the default start, so a move's first frame does not make them (the same values)
  const AT0 = [0.5, 0.55];
  function warm() {
    if (!cv.isConnected) return;
    const w = Math.max(2, Math.round(host.clientWidth / 2)), h = Math.max(2, Math.round(host.clientHeight / 2));
    if (w < 8 || h < 8) { setTimeout(warm, 500); return; }   // not laid out yet
    if ((F && cv.width === w && cv.height === h) || (pre && pre.w === w && pre.h === h && pre.seed === seed)) return;
    const job = (pre = { w, h, seed, steps: fieldSteps(w, h, seed), F: null, T: null });
    const slice = () => { if (pre !== job) return; if (!job.steps.step(24)) { setTimeout(slice, 0); return; } job.F = job.steps.f; job.T = arrivals(job.F, w, h, AT0); };
    setTimeout(slice, 0);
  }
  setTimeout(warm, 1500); addEventListener("resize", () => setTimeout(warm, 800));
  const run = (from, to, ms, at) => new Promise((done) => {
    cancelAnimationFrame(raf);
    const w = Math.max(2, Math.round(host.clientWidth / 2)), h = Math.max(2, Math.round(host.clientHeight / 2));
    if (cv.width !== w || cv.height !== h || !F) { cv.width = w; cv.height = h; if (pre && pre.F && pre.w === w && pre.h === h && pre.seed === seed) { F = pre.F; Tk = { F, at: AT0.join(), T: pre.T }; seed++; } else F = field(w, h, seed++); pre = null; }
    const g = cv.getContext("2d"), img = g.createImageData(w, h), o = img.data;
    // each pixel's arrival: its distance from the start, bent by the field (the ink runs ahead along low ground)
    const T = Tk && Tk.F === F && Tk.at === at.join() ? Tk.T : (Tk = { F, at: at.join(), T: arrivals(F, w, h, at) }).T;
    cv.hidden = false; const t0 = performance.now();
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / ms), e = k * k * (3 - 2 * k), lvl = from + (to - from) * e;
      for (let i = 0; i < w * h; i++) { const on = T[i] < lvl * 1.12 - 0.06, j = i * 4; o[j] = INK[0]; o[j + 1] = INK[1]; o[j + 2] = INK[2]; o[j + 3] = on ? 255 : 0; }
      g.putImageData(img, 0, 0);
      if (k < 1) raf = requestAnimationFrame(frame); else { if (to <= 0) cv.hidden = true; done(); }
    };
    raf = requestAnimationFrame(frame);
  });
  const api = {
    cover: ({ at = [0.5, 0.55], ms = 520 } = {}) => run(0, 1, ms, at),
    reveal: ({ at = [0.5, 0.55], ms = 640 } = {}) => run(1, 0, ms, at),
    async faint({ hold = 900 } = {}) { await api.cover({ ms: 1400, at: [0.5, 0.6] }); await new Promise((r) => setTimeout(r, hold)); await api.reveal({ ms: 1600 }); },
    stop() { cancelAnimationFrame(raf); cv.remove(); },
  };
  globalThis.__lwInkBlot = api;
  return api;
}
