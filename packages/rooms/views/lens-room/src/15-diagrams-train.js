function spotAt(f, lamUm) {
  setTrain(48, 48, 3, 0, f);
  sV("uLam", [lamUm, lamUm, lamUm]);
  return spotStats(drawProbe(48, 48), 48);
}
// Best focus shift along the image normal, least squares over a fan: where rays from the pupil cross, compared to the image surface.
function focusShift(f) {
  const n = TR.s.length,
    g = trainFan(f);
  let A = 0,
    B = 0,
    c = 0;
  const im = TR.s[n - 1],
    cs = Math.cos(im.tilt),
    sn = Math.sin(im.tilt);
  const ys = [],
    ss = [];
  for (let k = 0; k < 25; k++) {
    const q = g(k, n),
      d = g(k, n + 1);
    if (q[3] < 0.5) continue;
    const dz = -sn * d[1] + cs * d[2];
    if (Math.abs(dz) < 1e-6) continue;
    const sl = (cs * d[1] + sn * d[2]) / dz,
      y = cs * (q[1] - im.y) + sn * (q[2] - im.z);
    ys.push(y);
    ss.push(sl);
  }
  if (ys.length < 3) return null;
  const my = ys.reduce((a, b) => a + b) / ys.length,
    ms = ss.reduce((a, b) => a + b) / ss.length;
  let nu = 0,
    de = 0;
  ys.forEach((y, i) => {
    nu += (ss[i] - ms) * (y - my);
    de += (ss[i] - ms) ** 2;
  });
  return de > 0 ? -nu / de : null;
}
