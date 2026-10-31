// ======================================================================= Caustic view
// Sun rays through the same trace onto the floor at y = -1.7, binned.
function runCaustic() {
  const N = 1024,
    B = 360;
  const St = Object.assign({}, S, { stopR: 3.2 * S.size + (S.two ? S.sp * 0.3 : 0) });
  setLens(St, N, N, 4);
  const px = drawProbe(N, N);
  const span = 7 * S.size + 3,
    cx0 = -0.945,
    cz0 = 0.661 + (S.two ? S.sp * 0.5 : 0),
    h = new Float32Array(B * B);
  let tot = 0,
    mx = 0;
  for (let i = 0; i < N * N; i++) {
    if (px[i * 4 + 3] < 0.5) continue;
    const x = (((px[i * 4] - cx0) / span + 0.5) * B) | 0,
      y = (((px[i * 4 + 1] - cz0) / span + 0.5) * B) | 0;
    if (x < 0 || y < 0 || x >= B || y >= B) continue;
    h[y * B + x] += px[i * 4 + 2];
    tot += px[i * 4 + 2];
  }
  let mean = 0,
    nz = 0;
  for (const v of h) {
    if (v > 0) {
      mean += v;
      nz++;
    }
    if (v > mx) mx = v;
  }
  mean /= nz || 1;
  last.caustic = { peak: mx / mean, mean, mx };
  const c = $("over"),
    rr = $("view").getBoundingClientRect();
  const w = (c.width = Math.round(rr.width)),
    hh = (c.height = Math.round(rr.height)),
    x = c.getContext("2d");
  x.fillStyle = "#04050a";
  x.fillRect(0, 0, w, hh);
  const sz = Math.min(w, hh) - 16,
    im = x.createImageData(B, B);
  for (let i = 0; i < B * B; i++) {
    const v = Math.min(1, Math.pow(h[i] / (mean * 6), 0.6)),
      o = i * 4;
    im.data[o] = 255 * v;
    im.data[o + 1] = 235 * v * v + 20 * v;
    im.data[o + 2] = 190 * v * v * v + 10 * v;
    im.data[o + 3] = 255;
  }
  const off = document.createElement("canvas");
  off.width = off.height = B;
  off.getContext("2d").putImageData(im, 0, 0);
  x.imageSmoothingEnabled = true;
  x.drawImage(off, (w - sz) / 2, (hh - sz) / 2, sz, sz);
  x.fillStyle = "#9a9ca3";
  x.font = "12px 'JetBrains Mono',monospace";
  x.fillText("light on the floor, top view", 12, hh - 12);
  setRead([
    ...(last.rows || []).filter((r) => !/Peak/.test(r[0])),
    ["Peak over mean on floor", fmt(mx / mean, 1)],
  ]);
}
