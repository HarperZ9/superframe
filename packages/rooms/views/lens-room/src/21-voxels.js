// Voxel map of the medium, read with the same f the rays use. It places objects for any shape and finds where to stand.
let VOX = null;
const VOXC = {};
function voxKey(St) {
  return [
    St.shape,
    St.shape === "F" && St.formula ? St.formula.text : "",
    St.curve.toFixed(3),
    St.inv,
    St.liqK || "",
    St.shape === 51 ? St.volt : St.shape === 50 ? St.bond : 0,
    St.morphOn ? St.shapeM + St.morph : "",
  ].join("|");
}
function voxels(St) {
  const k = voxKey(St);
  if (VOXC[k]) return (VOX = VOXC[k]);
  const q = Object.assign({}, St, {
    inner: null,
    pol: 0,
    polA: 0,
    polP: 0,
    pt: false,
    two: 0,
    mat: 0,
  });
  setLens(q, 256, 128, 6, 1);
  const px = drawProbe(256, 128);
  const pts = [];
  for (let i = 0; i < 32768; i++) {
    const d = px[i * 4];
    if (d < -0.012) pts.push([-d, px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3]]);
  }
  pts.sort((a, b) => b[0] - a[0]);
  const pick = [];
  for (const [spacing] of [[0.55], [0.36], [0.2], [0.1]]) {
    for (const a of pts) {
      if (pick.length >= 14) break;
      if (pick.every((b) => Math.hypot(a[1] - b[1], a[2] - b[2], a[3] - b[3]) > spacing))
        pick.push(a);
    }
    if (pick.length >= 9) break;
  }
  return (VOX = VOXC[k] = { k, pts, pick, deep: pts[0] || null });
}
function innerData(St) {
  const v = voxels(St),
    P = v.pick,
    io = [],
    ca = [],
    cb = [];
  let ip = 0,
    lamp = null;
  const set = St.inner;
  const R = (a, m, f = 0.72) => Math.min(m, Math.max(0.012, a[0] * f));
  if (set == "spheres") {
    P.forEach((a, i) => io.push(a[1], a[2], a[3], R(a, 0.26, 0.6) * (0.6 + 0.4 * hsh(i))));
    ip = P[0] ? P[0][2] - Math.max(0.05, P[0][0] * 0.55) : 0;
  } else if (set == "crystals") {
    P.forEach((a, i) => io.push(a[1], a[2], a[3], R(a, 0.3, 0.55)));
  } else if (set == "cell") {
    P.forEach((a, i) => {
      const r = R(a, 0.3, 0.68) * (i ? 0.6 + 0.4 * hsh(i) : 1);
      io.push(a[1], a[2], a[3], r);
    });
    for (let i = 1; i < P.length && ca.length / 4 < 24; i++) {
      const a = P[i],
        r = R(a, 0.3, 0.68);
      const d = [hsh(i + 1) - 0.5, hsh(i + 2) - 0.5, hsh(i + 3) - 0.5],
        L = Math.hypot(...d) || 1;
      for (const s of [1.1, 1.35]) {
        const b = [a[1] + (d[0] / L) * r * s, a[2] + (d[1] / L) * r * s, a[3] + (d[2] / L) * r * s];
        ca.push(b[0], b[1], b[2], r * 0.14);
        cb.push(
          b[0] + (d[1] / L) * r * 0.5,
          b[1] - (d[0] / L) * r * 0.5,
          b[2] + (d[2] / L) * r * 0.3,
          0
        );
      }
    }
  } else if (set == "tree") {
    const a = P[0] || [0.2, 0, 0, 0];
    let n = 0;
    const low = [a[1], a[2] - a[0] * 0.8, a[3]];
    const grow = (x, dir, len, rad, lev) => {
      if (n >= 24 || lev > 5) return;
      const e = [x[0] + dir[0] * len, x[1] + dir[1] * len, x[2] + dir[2] * len];
      ca.push(x[0], x[1], x[2], rad);
      cb.push(e[0], e[1], e[2], lev >= 4 ? 1 : 0);
      n++;
      if (lev >= 4) return;
      for (const sg of [-1, 1]) {
        const an = 0.62 * sg + (hsh(n) - 0.5) * 0.3,
          az = hsh(n + 9) * 6.28,
          c = Math.cos(an),
          s = Math.sin(an);
        const p1 = [Math.cos(az), 0, Math.sin(az)];
        const nd = [dir[0] * c + p1[0] * s, dir[1] * c + 0.15 * s, dir[2] * c + p1[2] * s],
          L = Math.hypot(...nd);
        grow(e, [nd[0] / L, nd[1] / L, nd[2] / L], len * 0.72, rad * 0.68, lev + 1);
      }
    };
    grow(low, [0, 1, 0], Math.max(0.12, a[0] * 0.65), Math.max(0.008, a[0] * 0.09), 0);
  } else if (set == "room") {
    const a = P[0] || [0.2, 0, 0, 0],
      w = Math.max(0.03, a[0] * 0.62);
    io.push(a[1], a[2], a[3], w);
    io.push(a[1] - w * 0.3, a[2] - w * 0.7, a[3] + w * 0.2, w * 0.28);
    io.push(a[1] + w * 0.42, a[2] - w * 0.8, a[3] - w * 0.3, w * 0.2);
    lamp = [a[1], a[2] + w * 0.62, a[3], w * w * 0.7];
  }
  if (St.iLamp && !lamp) {
    const a = P[0] || [0.2, 0, 0, 0];
    lamp = [a[1] + a[0] * 0.25, a[2] + a[0] * 0.45, a[3] - a[0] * 0.1, a[0] * a[0] * 0.9];
  }
  return { io, ca, cb, ip, lamp };
}
