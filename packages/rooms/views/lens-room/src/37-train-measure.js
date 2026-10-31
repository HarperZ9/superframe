function measureTrain() {
  const n = TR.s.length,
    isObj = TR.obj !== undefined;
  const g = trainParax();
  const hRay = 0.02 * (TR.pupil || TR.s[0].ap);
  const dlast = g(25, n + 1),
    plast = g(25, n);
  let efl = NaN,
    mag = null;
  const q = TR.s[n - 1],
    cs = Math.cos(q.tilt),
    sn = Math.sin(q.tilt);
  const tr = (d) => Math.hypot(d[0], cs * d[1] + sn * d[2]); // transverse part in the image frame, safe in single precision
  if (!isObj) {
    if (TR.p.marginal) {
      const fg = trainFan(0),
        pu = TR.pupil || TR.s[0].ap;
      efl = (0.985 * pu) / tr(fg(24, n + 1));
    } else {
      const su = tr(dlast);
      if (su > 0) efl = hRay / su;
    }
  }
  const fd = isObj ? S.tfield * (TR.objField || 0.1) : tFieldRad();
  const px = trainSpot(fd),
    st = spotStats(px, 96);
  const p0 = trainSpot(isObj ? 0 : 0),
    s0 = spotStats(p0, 96);
  if (isObj) {
    const dy = 0.02;
    const pm = trainSpot(dy),
      sm = spotStats(pm, 96);
    if (sm.n && s0.n) mag = (sm.my - s0.my) / dy;
  }
  const ap = TR.pupil || TR.s[0].ap;
  const fnum = efl / (2 * ap);
  const airy = ((1.22 * 0.55e-6) / (TR.unitM || 1)) * fnum;
  last.train = { efl, mag, st, s0, fnum };
  const rows = [];
  if (!isObj) {
    rows.push(["Focal length, from rays", fmt(efl, 4)]);
    if (TR.p.expect) {
      rows.push(
        ["Published or derived", TR.p.expect],
        ["Difference", fmt((100 * (efl - TR.p.expect)) / TR.p.expect, 3) + "%"]
      );
    }
    rows.push(["Focal ratio", "f/" + fmt(fnum, 2)]);
  } else {
    rows.push(
      ["Magnification, from rays", mag == null ? "none" : fmt(mag, 2)],
      ["Numerical aperture", fmt(naFromRays(), 3)]
    );
  }
  rows.push(["RMS spot, on axis", s0.n ? s0.rms.toExponential(2) : "no rays"]);
  if (S.tfield > 0) rows.push(["RMS spot, this field", st.n ? st.rms.toExponential(2) : "no rays"]);
  rows.push(["Max spot radius", st.n ? st.max.toExponential(2) : "none"]);
  rows.push(["Rays through", st.n + " of " + st.inP]);
  if (!isObj) rows.push(["Airy radius at 550 nm", airy.toExponential(2)]);
  rows.push(["Surfaces in train", String(n)]);
  setRead(rows);
  $("model").textContent =
    "All lengths in the prescription's units. Single precision rays: spot values under about 1e-6 of the focal length are numerical noise. Sequential trace: rays visit surfaces in order, so central obscuration is modelled as a hole in the first mirror.";
  S.tgain = st.n ? Math.min(8, 1 / (st.n / st.inP)) : 1;
  drawSpot(st);
  if (S.view == "side") drawTrainSide();
}
function naFromRays() {
  const g = trainFan(0);
  let best = 0;
  for (let k = 0; k < 25; k++) {
    const r1 = g(k, 1),
      r0 = g(k, 0);
    if (r1[3] < 0.5) continue;
    const v = [r1[0] - r0[0], r1[1] - r0[1], r1[2] - r0[2]];
    const l = Math.hypot(...v);
    best = Math.max(best, Math.abs(v[1]) / l);
  }
  return best * (TR.n0 || 1);
}
function drawSpot(st) {
  const c = $("spot"),
    x = c.getContext("2d"),
    w = c.width;
  x.fillStyle = "#05060a";
  x.fillRect(0, 0, w, w);
  if (!st.n) return;
  const sc = (w * 0.42) / Math.max(st.max, 1e-9);
  x.fillStyle = "rgba(143,211,255,.8)";
  for (const p of st.pts)
    x.fillRect(w / 2 + (p[0] - st.mx) * sc, w / 2 - (p[1] - st.my) * sc, 1.6, 1.6);
  x.fillStyle = "#9a9ca3";
  x.font = "11px 'JetBrains Mono',monospace";
  x.fillText("frame ±" + (st.max / 0.84).toExponential(1), 8, w - 8);
}
