function runWave() {
  const P = 128,
    N = 1024;
  const isT = S.kind == "train";
  const lamU = isT ? (S.waveL * 1e-9) / (TR.unitM || 1) : (S.waveL * 1e-3) / S.waveU;
  const pup = isT ? TR.pupil || TR.s[0].ap : 0;
  const D = isT ? 2 * pup : S.stopD;
  let px;
  if (!isT) {
    const St = Object.assign({}, S, {
      stopR: (D / 2) * 1.02,
      zr: (S.two ? S.sp : 0) + 2.2 * S.size,
    });
    setLens(St, P, P, 3);
    px = drawProbe(P, P);
  } else {
    const sv = TR.pupil;
    TR.pupil = pup * 1.02;
    setTrain(P, P, 3, 0, 0);
    px = drawProbe(P, P);
    TR.pupil = sv;
  }
  const dx = (D * 1.02) / P,
    R = D / 2,
    re = new Float64Array(N * N),
    im = new Float64Array(N * N);
  let ref = 0,
    cnt = 0;
  const opl = (i) => (S.kind == "lens" ? px[i * 4] : px[i * 4 + 2]),
    al = (i) => (S.kind == "lens" ? px[i * 4 + 1] : px[i * 4 + 3]);
  for (let i = P * P; i-- > 0; )
    if (al(i) > 0.5) {
      ref += opl(i);
      cnt++;
    }
  ref /= cnt || 1;
  const z = isT ? Math.abs((last.train && last.train.efl) || 10) : S.waveZ;
  const k = (2 * Math.PI) / lamU,
    chirp = S.kind == "lens" && !S.waveIdeal ? Math.PI / (lamU * z) : 0;
  let maxStep = 0,
    prev = null;
  for (let y = 0; y < P; y++) {
    for (let x = 0; x < P; x++) {
      const i = y * P + x,
        xx = (x + 0.5 - P / 2) * dx,
        yy = (y + 0.5 - P / 2) * dx,
        rr = Math.hypot(xx, yy),
        cover = Math.max(0, Math.min(1, (R - rr) / dx + 0.5));
      if (cover <= 0 || al(i) < 0.5) continue;
      const ph = k * (opl(i) - ref) + chirp * rr * rr;
      if (x > 0 && al(i - 1) > 0.5) {
        const pp = k * (opl(i - 1) - ref) + chirp * ((x - 0.5 - P / 2) * dx) ** 2 + chirp * yy * yy;
        maxStep = Math.max(maxStep, Math.abs(ph - pp));
      }
      const o = ((y + N / 2 - P / 2) % N) * N + ((x + N / 2 - P / 2) % N);
      re[o] = cover * Math.cos(ph);
      im[o] = cover * Math.sin(ph);
    }
  }
  fft2(re, im, N);
  const I = new Float64Array(N * N);
  let mx = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const o = ((y + N / 2) % N) * N + ((x + N / 2) % N),
        q = re[o] * re[o] + im[o] * im[o];
      I[y * N + x] = q;
      if (q > mx) mx = q;
    }
  // Radial profile about the optical axis, used for the first dark ring and the ring peak.
  const bins = new Float64Array(N / 2),
    cn = new Float64Array(N / 2);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x - N / 2, y - N / 2) | 0;
      if (r < N / 2) {
        const a = Math.hypot(x - N / 2, y - N / 2) - r;
        bins[r] += I[y * N + x];
        cn[r]++;
      }
    }
  for (let i = 0; i < N / 2; i++) bins[i] /= cn[i] || 1;
  const binSize = (lamU * z) / (N * dx);
  let dark = null;
  const centerRatio = I[(N / 2) * N + N / 2] / (mx || 1);
  for (let i = 2; i < N / 4; i++) {
    if (bins[i] < bins[i - 1] && bins[i] <= bins[i + 1] && bins[i] < bins[0] * 0.2) {
      const a = bins[i - 1],
        b = bins[i],
        c = bins[i + 1],
        off = (0.5 * (a - c)) / (a - 2 * b + c || 1);
      dark = (i + off) * binSize;
      break;
    }
  }
  let ring = 0,
    rp = 0;
  for (let i = 0; i < N / 4; i++)
    if (bins[i] > rp) {
      rp = bins[i];
      ring = i * binSize;
    }
  const pred = (1.22 * lamU * z) / D;
  last.wave = {
    dark,
    pred,
    err: dark ? (100 * (dark - pred)) / pred : null,
    centerRatio,
    ring,
    binSize,
    maxStep,
    z,
    D,
    lamU,
  };
  const rows = [
    ["Wavelength", S.waveL + " nm"],
    ["Scale", isT ? "prescription units" : "1 unit = " + S.waveU + " µm"],
    ["Stop D, distance z", D.toFixed(2) + ", " + z.toFixed(2)],
    ["First dark ring, FFT", dark ? dark.toExponential(3) : "none"],
    ["1.22 λ z/D", pred.toExponential(3)],
    ["Difference", dark ? fmt((100 * (dark - pred)) / pred, 2) + "%" : "none"],
    ["Centre over peak", centerRatio.toExponential(2)],
    ["Brightest ring radius", ring.toExponential(3)],
    [
      "Phase step per sample",
      fmt(maxStep, 2) + " rad" + (maxStep > Math.PI ? " undersampled" : ""),
    ],
  ];
  setRead(rows);
  $("model").textContent =
    (isT
      ? "In Train mode the pupil shape comes from the rays and phase carries segment piston only: single precision ray paths cannot resolve nanometres over tens of metres, so mirror figure appears in the spot diagram and not here. "
      : "") +
    "Approximation: ray-derived phase on a pupil grid, with amplitude one inside the stop, then Fraunhofer or Fresnel propagation by FFT. It keeps interference that ray view cannot show and it ignores diffraction inside the lens and amplitude changes at surfaces. Pupil grid 128, padded to 1024.";
  const c = $("over"),
    rr = $("view").getBoundingClientRect();
  const w = (c.width = Math.round(rr.width)),
    h = (c.height = Math.round(rr.height)),
    x = c.getContext("2d");
  x.fillStyle = "#04050a";
  x.fillRect(0, 0, w, h);
  const sz = Math.min(w, h) - 20,
    span = Math.min(400, Math.max(40, Math.round(((4 * pred) / binSize) * 2))),
    img = x.createImageData(sz, sz);
  const tint = [
    255 * Math.min(1, S.waveL > 580 ? 1 : S.waveL < 490 ? 0.2 : (S.waveL - 490) / 90),
    255 * Math.max(0.25, 1 - Math.abs(S.waveL - 540) / 120),
    255 * Math.max(0.1, 1 - (S.waveL - 430) / 90),
  ];
  for (let j = 0; j < sz; j++)
    for (let i = 0; i < sz; i++) {
      const a = Math.round(N / 2 + (i / sz - 0.5) * span),
        b = Math.round(N / 2 + (j / sz - 0.5) * span);
      const v = Math.pow(Math.max(0, 1 + Math.log10(Math.max(I[b * N + a] / mx, 1e-6)) / 4), 1.1),
        o = (j * sz + i) * 4;
      img.data[o] = v * tint[0];
      img.data[o + 1] = v * tint[1];
      img.data[o + 2] = v * tint[2];
      img.data[o + 3] = 255;
    }
  x.putImageData(img, (w - sz) / 2, (h - sz) / 2);
  x.fillStyle = "#9a9ca3";
  x.font = "12px 'JetBrains Mono',monospace";
  x.fillText("log intensity, frame ±" + ((span / 2) * binSize).toExponential(2), 12, h - 12);
  if (dark) {
    x.strokeStyle = "rgba(255,255,255,.3)";
    x.beginPath();
    x.arc(w / 2, h / 2, (dark / binSize / span) * sz, 0, 7);
    x.stroke();
  }
}
