/* Light, noise, time, space: four faders, one closed form. The picture is the same scene exposed at those settings, and the map
   shows the bits at every shutter and pixel size for this light and noise, with a mark at where you stand. */
(function (g) {
  "use strict";
  const T = g.Transducers, V = g.TView, A = (g.TAxes = {});
  const N = 256, SCENE = (() => { const s = T.scene(N, 1); let m = 0; for (const x of s) m = Math.max(m, x); return s.map((x) => x / m); })();
  const log = (u, a, b) => a * (b / a) ** u;
  const read = () => {
    const v = (id) => +document.getElementById(id).value / 100;
    return { L: log(v("ax-light"), 1e4, 1e8), r: log(v("ax-noise"), 0.3, 100), t: log(v("ax-time"), 1e-3, 1), p: log(v("ax-space"), 1 / 256, 1 / 8), A: 1, D: 1 };
  };
  /* Expose the scene: pixels of side p, photons L t p^2 at full white, Poisson noise, read noise, then a tone map. */
  const expose = (c, o, W) => {
    const x = V.setup(c, W, W), cells = Math.max(2, Math.round(1 / o.p)), off = new OffscreenCanvas(cells, cells), q = off.getContext("2d"), im = q.createImageData(cells, cells), r = T.rng(7, "expose"), S = o.L * o.t * o.p * o.p;
    for (let y = 0; y < cells; y++) for (let k = 0; k < cells; k++) {
      const sy = Math.min(N - 1, Math.floor((y * N) / cells)), sx = Math.min(N - 1, Math.floor((k * N) / cells)), m = S * SCENE[sy * N + sx], e = T.poisson(r, m) + o.r * T.gauss(r), t = Math.max(0, Math.min(1, e / Math.max(S, 1e-9))), b = Math.round(255 * Math.pow(t, 0.6)), i = 4 * (y * cells + k);
      im.data[i] = im.data[i + 1] = im.data[i + 2] = b; im.data[i + 3] = 255;
    }
    q.putImageData(im, 0, 0);
    x.imageSmoothingEnabled = false; x.drawImage(off, 0, 0, W, W);
  };
  /* The trade map. Each cell is one pixel size and one shutter, coloured by bits. */
  const tradeMap = (c, o, W, H) => {
    const x = V.setup(c, W, H), g2 = 40; let top = 0;
    const I = new Float64Array(g2 * g2);
    for (let a = 0; a < g2; a++) for (let b = 0; b < g2; b++) { const v = T.fourAxes({ L: o.L, r: o.r, A: 1, D: 1, t: log(a / (g2 - 1), 1e-3, 1), p: log(b / (g2 - 1), 1 / 256, 1 / 8) }).I; I[a * g2 + b] = v; if (v > top) top = v; }
    const off = new OffscreenCanvas(g2, g2), q = off.getContext("2d"), im = q.createImageData(g2, g2), rgb = V.css("--ink").match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16)), acc = V.css("--red");
    for (let a = 0; a < g2; a++) for (let b = 0; b < g2; b++) {
      const i = 4 * ((g2 - 1 - a) * g2 + b);
      im.data[i] = rgb[0]; im.data[i + 1] = rgb[1]; im.data[i + 2] = rgb[2]; im.data[i + 3] = 255 * Math.sqrt(I[a * g2 + b] / Math.max(top, 1e-9));
    }
    q.putImageData(im, 0, 0);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(off, 0, 0, W, H);
    const u = Math.log(o.p / (1 / 256)) / Math.log(32), w = Math.log(o.t / 1e-3) / Math.log(1000);
    x.strokeStyle = acc; x.lineWidth = 2; x.beginPath(); x.arc(u * W, H - w * H, 7, 0, 2 * Math.PI); x.stroke();
    x.beginPath(); x.moveTo(u * W, 0); x.lineTo(u * W, H); x.moveTo(0, H - w * H); x.lineTo(W, H - w * H); x.lineWidth = 0.75; x.stroke();
    x.font = "500 12px " + V.css("--face-utility");
    const label = (s, px, py) => { const w2 = x.measureText(s).width; x.fillStyle = V.css("--wall"); x.fillRect(px - 3, py - 12, w2 + 6, 16); x.fillStyle = V.css("--ink"); x.fillText(s, px, py); };
    label("space: fine to coarse", 6, H - 6);
    x.save(); x.translate(16, H - 28); x.rotate(-Math.PI / 2); label("time: short to long", 0, 0); x.restore();
  };
  A.draw = () => {
    const o = read(), f = T.fourAxes(o), wide = document.getElementById("ax-img").parentElement.clientWidth, side = Math.max(160, Math.min(420, wide));
    expose(document.getElementById("ax-img"), o, side);
    tradeMap(document.getElementById("ax-map"), o, side, side);
    const set = (id, s) => { document.getElementById(id).textContent = s; };
    set("ax-photons", V.fmt(f.photons) + " photons a cell");
    set("ax-floor", V.fmt(f.noise) + " rms in a cell");
    set("ax-dt", (o.t * 1000).toFixed(o.t < 0.01 ? 1 : 0) + " ms");
    set("ax-dx", Math.round(1 / o.p) + " cells across");
    set("ax-bits", V.fmt(f.I) + " bits");
    set("ax-per", f.bitsPerPhoton.toFixed(2) + " bits per photon");
  };
  A.init = () => { for (const id of ["ax-light", "ax-noise", "ax-time", "ax-space"]) document.getElementById(id).addEventListener("input", A.draw); addEventListener("resize", A.draw); if (g.Kit) g.Kit.on(A.draw); A.draw(); };
})(globalThis);
