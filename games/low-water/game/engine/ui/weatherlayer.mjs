// The night over the plate, as the prototype laid it (game/look.mjs, retired): the tide's water,
// fog that takes the far and low things first (sodium-lit near the lamps, cold elsewhere, paper
// white in a blackout), rain streaks, Mother's beam when she burns, and the lights mirrored in the
// water. One canvas between the plate and the people. Water and fog are worked out per plate
// sample from the geo buffers (world/plateworld.mjs) into a field at the geo buffers' size, and
// only when the tide, the fog or the blackout has moved enough to show; the rest is drawn per
// frame. Plates without a datum (rooms, the hill) take no water.
//   const L = weatherLayer(ctx, host, cam); L.stop()
import { h } from "./dom.mjs";
import { camBasis } from "../world/plateworld.mjs";
import { projectPlate } from "../world/camera.mjs";
import { smokeField } from "../paint/smoke.mjs";
import { blueNoise } from "../paint/glyph/bluenoise.mjs";
const BN = blueNoise(64);

// Mother's beam turns at BEAM_RATE (world/beam.mjs, shared with combat).
import { BEAM_RATE } from "../world/beam.mjs";
export { BEAM_RATE };
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const FOG_LIT = [0.62, 0.4, 0.17], FOG_COLD = [0.24, 0.22, 0.3], FOG_PAPER = [0.86, 0.83, 0.77];

export function weatherLayer(ctx, host, cam) {
  const G = ctx.G, canvas = h("canvas.weathercanvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  host.append(canvas);
  const S = { field: null, key: "", plate: null, raf: 0, stopped: false, t: 0, last: performance.now() };
  const term = (k) => { try { return G.env.term(k, G.state.place); } catch (e) { return 0; } };

  function waterY(pj) { return pj && pj.datum ? pj.datum.a + pj.datum.b * (+term("tide") || 0) : -Infinity; }
  // The water and fog field at the geo buffers' size, premultiplied. Built a band of rows at a time inside
  // a few milliseconds a frame, the last field shown until the new one is whole (quay-rain had one frame of
  // about 550 ms every four seconds as the tide moved a centimetre: the performance engineer's find). What
  // does not change with tide, fog or blackout (each sample's fog weight, its sodium glow) is worked out
  // once per plate, also in bands.
  const BUDGET_MS = 4;
  function statics(pj, geo) {
    const s = pj.geoScale || 1, gw = Math.round(pj.width * s), gh = Math.round(pj.height * s);
    if (S.stat && S.stat.pj === pj && S.stat.geo === geo) return S.stat;
    const B = camBasis(pj.camera), lamps = ((pj.marks || {}).lamps || []).filter((l) => l.kind === "sodium").map((l) => projectPlate(pj.camera, gw, gh, l.at)), glowR = 260 * (gw / 1280);
    S.stat = { pj, geo, gw, gh, B, lamps, glowR, W: new Float32Array(gw * gh), GL: new Float32Array(gw * gh), row: 0, done: false };
    return S.stat;
  }
  function stepStatics(T, t0) {
    const { pj, geo, gw, gh, B, lamps, glowR, W, GL } = T, P = geo.pos;
    while (T.row < gh && (t0 === Infinity || performance.now() - t0 < BUDGET_MS)) {
      const y = T.row++;
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x, px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2]; if (!Number.isFinite(py)) continue;
        const dep = (px - B.pos[0]) * B.f[0] + (py - B.pos[1]) * B.f[1] + (pz - B.pos[2]) * B.f[2];
        const far = clamp((dep - pj.camera.dist + 18) / 40), low = clamp(Math.exp(-(py + 3.4) / 7));
        W[i] = 13 * (0.3 + 0.7 * far) * (0.4 + 0.6 * low);
        let gl = 0; for (const L of lamps) { const d = Math.hypot(x - L[0], (y - L[1]) * 1.3) / glowR; if (d < 1) gl = Math.max(gl, (1 - d) * (1 - d)); } GL[i] = gl;
      }
    }
    T.done = T.row >= gh;
  }
  // start a new field (the old one stays on screen) and carry it on a band at a time
  function startBuild(pj, geo, wy, fog, fade) {
    const T = statics(pj, geo); S.pending = { T, wy, fog, fade, img: new ImageData(T.gw, T.gh), row: 0 };
  }
  function stepBuild(t0) {
    const J = S.pending; if (!J) return;
    if (!J.T.done) { stepStatics(J.T, t0); if (!J.T.done) return; }
    const { T, wy, fog, fade, img } = J, { gw, gh, W, GL } = T, P = T.geo.pos, o = img.data, sodiumOn = 1 - fade, fogK = fog * 0.9;
    while (J.row < gh && (t0 === Infinity || performance.now() - t0 < BUDGET_MS)) {
      const y = J.row++;
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x, py = P[i * 3 + 1];
        if (!Number.isFinite(py)) continue;
        let r = 0, g = 0, b = 0, a = 0;
        if (py < wy) { // the tide: black and slick, deeper darker
          const dpt = clamp((wy - py) * 8), k = 0.55 + 0.4 * dpt;
          r = 0.045 * k; g = 0.07 * k; b = 0.11 * k; a = k;
          const above = y > 0 ? P[(i - gw) * 3 + 1] : py;
          if (!(above < wy)) { r += 0.12; g += 0.11; b += 0.1; a = Math.max(a, 0.5); } // a pale line where the water stops
        }
        if (fogK > 0) {
          const f = clamp(fogK * W[i]) * 0.85, gl = GL[i] * sodiumOn;
          const fr = FOG_PAPER[0] * fade + (FOG_COLD[0] * (1 - gl) + FOG_LIT[0] * gl) * (1 - fade), fg = FOG_PAPER[1] * fade + (FOG_COLD[1] * (1 - gl) + FOG_LIT[1] * gl) * (1 - fade), fb = FOG_PAPER[2] * fade + (FOG_COLD[2] * (1 - gl) + FOG_LIT[2] * gl) * (1 - fade);
          r = r * (1 - f) + fr * f; g = g * (1 - f) + fg * f; b = b * (1 - f) + fb * f; a = a + f * (1 - a);
        }
        if (a <= 0) continue;
        const j = i * 4; o[j] = clamp(r / a) * 255; o[j + 1] = clamp(g / a) * 255; o[j + 2] = clamp(b / a) * 255; o[j + 3] = clamp(a) * 255;
      }
    }
    if (J.row >= gh) {
      const c = (S.field && S.field.width === gw && S.field.height === gh) ? S.field : new OffscreenCanvas(gw, gh);
      c.getContext("2d").putImageData(img, 0, 0); S.field = c; S.pending = null;
    }
  }
  function mirrors(g, pj, wy, fade, view) {
    const lights = [...((pj.lights && pj.lights[(cam.area() && cam.area().variant) || pj.variants[0]]) || [])].filter((L) => !(L.kind === "sodium" && fade > 0.5));
    g.save(); g.globalCompositeOperation = "lighter";
    for (const L of lights) {
      if (L.at[1] < wy) continue;
      const m = cam.toScreen([L.at[0], 2 * wy - L.at[1], L.at[2]]), top = cam.toScreen([L.at[0], wy, L.at[2]]); if (!m || !top) continue;
      const y = (m[1] + top[1]) / 2, under = cam.pointAt(m[0], y); if (!under || under[1] >= wy) continue; // only where the water is
      const hh = Math.min(26 * view.zoom, Math.max(14, Math.abs(m[1] - top[1]) * 0.8)), w = 4 * view.zoom, k = Math.min(1, (L.I || 1) * 0.35) * (0.55 + 0.45 * Math.sin(S.t * 1.7 + L.at[0]));
      const c = L.kind === "sodium" ? "255,150,60" : "255,200,120";
      const grd = g.createRadialGradient(m[0], y, 0, m[0], y, hh); grd.addColorStop(0, `rgba(${c},${0.45 * k})`); grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd; g.beginPath(); g.ellipse(m[0], y, w, hh, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function rain(g, W, H, rate, fade) {
    if (rate <= 0.05) return;
    const n = Math.floor(Math.min(1, rate / 2) * 420), slant = -0.25;
    g.save(); g.lineWidth = 1;
    for (let k = 0; k < n; k++) {
      const hx = Math.abs((Math.sin(k * 12.9898 + 7) * 43758.5453) % 1), hy = Math.abs((Math.sin(k * 78.233 + 7) * 12543.12) % 1), sp = 0.9 + 0.4 * hx;
      const x = ((hx * W + S.t * 60 * slant * sp) % W + W) % W, y = ((hy * H + S.t * 900 * sp) % H + H) % H, len = 14 + 10 * hy, lit = fade > 0.5 ? 0.3 : 0.08 + 0.2 * Math.abs(Math.sin(k));
      g.strokeStyle = fade > 0.5 ? `rgba(230,225,214,${lit})` : `rgba(255,190,110,${lit})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + slant * len, y + len); g.stroke();
    }
    g.restore();
  }
  function beam(g, pj, fog) {
    const L = ((pj.marks || {}).lamps || []).find((l) => l.kind === "beam"); if (!L) return;
    const s = cam.toScreen(L.at); if (!s) return;
    const [hx, hy] = s, a = S.t * BEAM_RATE, len = 1400;
    g.save(); g.globalCompositeOperation = "lighter";
    for (const sg of [-1, 1]) {
      const ang = a + (sg > 0 ? 0 : Math.PI), spread = 0.1, k = 0.55 + 3 * fog, grd = g.createRadialGradient(hx, hy, 10, hx, hy, len);
      grd.addColorStop(0, `rgba(235,255,225,${0.55 * k})`); grd.addColorStop(0.35, `rgba(200,255,200,${0.18 * k})`); grd.addColorStop(1, "rgba(160,220,160,0)");
      g.fillStyle = grd; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(ang - spread) * len, hy + Math.sin(ang - spread) * len * 0.45); g.lineTo(hx + Math.cos(ang + spread) * len, hy + Math.sin(ang + spread) * len * 0.45); g.closePath(); g.fill();
    }
    const hg = g.createRadialGradient(hx, hy, 2, hx, hy, 70); hg.addColorStop(0, "rgba(240,255,230,0.95)"); hg.addColorStop(0.3, "rgba(150,255,140,0.5)"); hg.addColorStop(1, "rgba(80,200,80,0)");
    g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, 70, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // smoke and steam, dithered (paint/smoke.mjs): puffs' density summed on a grid of 2 plate pixels and
  // thresholded by the blue-noise tile at those WORLD-fixed plate pixels, so the dots stay put as the view pans
  S.smoke = smokeField(7); S.smokeCv = null;
  function smoke(g, pj, view, dt) {
    const variant = (cam.area() && cam.area().variant) || (pj.variants && pj.variants[0]);
    const puffs = S.smoke.step(pj, variant, dt, 0.25 + 0.5 * Math.min(1, (+term("wind") || 0) / 15)); if (!puffs.length) return;
    const ppm = pj.pxPerMetre || 80, P = puffs.map((q) => { const c = projectPlate(pj.camera, pj.width, pj.height, q.p); return { x: c[0], y: c[1], r: q.r * ppm, d: q.d, steam: q.steam }; }).filter((q) => q.d > 0.02);
    if (!P.length) return;
    const st = 2, x0 = Math.floor(Math.min(...P.map((q) => q.x - q.r)) / st) * st, y0 = Math.floor(Math.min(...P.map((q) => q.y - q.r)) / st) * st, x1 = Math.max(...P.map((q) => q.x + q.r)), y1 = Math.max(...P.map((q) => q.y + q.r));
    const w = Math.max(1, Math.ceil((x1 - x0) / st)), h = Math.max(1, Math.ceil((y1 - y0) / st)); if (w * h > 400000) return;
    if (!S.smokeCv || S.smokeCv.width < w || S.smokeCv.height < h) S.smokeCv = new OffscreenCanvas(Math.max(w, 64), Math.max(h, 64));
    const cx = S.smokeCv.getContext("2d"), img = S.smokeImg && S.smokeImg.width === w && S.smokeImg.height === h ? S.smokeImg : (S.smokeImg = cx.createImageData(w, h)), o = img.data;
    o.fill(0);   // kept frame to frame, cleared as a new one would be
    // each puff adds into the grid cells its circle covers, in the puffs' order, so a cell's sums are the
    // same additions as a pass over every puff for every cell (the same values), without visiting the puffs
    // that miss it (perf/PROGRESS.md 19)
    const n = w * h, D = (S.smokeD && S.smokeD.length >= n) ? S.smokeD : (S.smokeD = new Float64Array(n)), Lt = (S.smokeL && S.smokeL.length >= n) ? S.smokeL : (S.smokeL = new Float64Array(n));
    D.fill(0, 0, n); Lt.fill(0, 0, n);
    for (const q of P) {
      const rr = q.r * q.r, i0 = Math.max(0, Math.floor((q.x - q.r - x0) / st)), i1 = Math.min(w - 1, Math.ceil((q.x + q.r - x0) / st)), j0 = Math.max(0, Math.floor((q.y - q.r - y0) / st)), j1 = Math.min(h - 1, Math.ceil((q.y + q.r - y0) / st)), sl = q.steam ? 1 : 0.6;
      for (let j = j0; j <= j1; j++) { const py = y0 + j * st; for (let i = i0; i <= i1; i++) { const px = x0 + i * st, e = ((px - q.x) ** 2 + (py - q.y) ** 2) / rr; if (e < 1) { const k = q.d * (1 - e) * (1 - e), c = j * w + i; D[c] += k; Lt[c] += k * sl; } } }
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const px = x0 + i * st, py = y0 + j * st, c = j * w + i, d = D[c], lit = Lt[c];
      if (d <= 0.01 || d < BN.at(Math.floor(px / st), Math.floor(py / st))) continue;
      const k = (j * w + i) * 4, a = lit / d, up = BN.at(Math.floor(px / st) + 17, Math.floor(py / st) + 31) < 0.5;   // two inks: a lit grey, a cool shadow
      o[k] = up ? 150 * a + 40 : 52; o[k + 1] = up ? 140 * a + 38 : 56; o[k + 2] = up ? 128 * a + 40 : 70; o[k + 3] = 190;
    }
    cx.clearRect(0, 0, S.smokeCv.width, S.smokeCv.height); cx.putImageData(img, 0, 0);
    g.save(); g.imageSmoothingEnabled = false; g.drawImage(S.smokeCv, 0, 0, w, h, (x0 - view.left) * view.zoom, (y0 - view.top) * view.zoom, w * st * view.zoom, h * st * view.zoom); g.restore();
  }
  function frame(now) {
    if (S.stopped) return;
    const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now; S.t += dt;
    const r = host.getBoundingClientRect(); if (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) { canvas.width = Math.round(r.width); canvas.height = Math.round(r.height); }
    const g = canvas.getContext("2d"); g.clearRect(0, 0, canvas.width, canvas.height);
    const pj = cam.place(), geo = cam.geo(), view = cam.frameNow();
    if (cam.ready() && pj && geo && view) {
      const wy = waterY(pj), fog = +term("fog") || 0, fade = cam.darkness ? cam.darkness() : 0;
      const key = `${pj.place}|${Math.round(wy * 100)}|${Math.round(fog * 200)}|${Math.round(fade * 4)}`;
      if (key !== S.key) { S.key = key; startBuild(pj, geo, wy, fog, fade); }
      stepBuild(S.field ? performance.now() : Infinity);   // the first field whole at once, as before; later ones in bands
      const s = 1 / (pj.geoScale || 1);
      g.save(); g.imageSmoothingEnabled = true; g.setTransform(view.zoom * s, 0, 0, view.zoom * s, -view.left * view.zoom, -view.top * view.zoom); g.drawImage(S.field, 0, 0); g.restore();
      if (pj.datum) mirrors(g, pj, wy, fade, view);
      if (!/[?&]smoke=0/.test(location.search)) smoke(g, pj, view, dt);
      if (term("mother") === "burning") beam(g, pj, fog);
      const place = G.book.places[G.state.place] || {};
      if (!(place.shelter || place.stove)) rain(g, canvas.width, canvas.height, +term("rain") || 0, fade);
    }
    S.raf = requestAnimationFrame(frame);
  }
  S.raf = requestAnimationFrame(frame);
  return { canvas, stop() { S.stopped = true; cancelAnimationFrame(S.raf); canvas.remove(); } };
}
