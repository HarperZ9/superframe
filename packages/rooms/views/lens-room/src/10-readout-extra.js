// ======================================================================= Readout additions
function extraRows(g, t3, r4, h0) {
  const r = [];
  const St = S;
  if (St.mat == 1 && St.shape !== 52) {
    const x = g(0, 1),
      d = g(0, 2);
    if (d[2] < 0) {
      const dev = (Math.acos(Math.min(1, Math.abs(d[2]))) * 180) / Math.PI,
        ty = d[1] / d[2],
        zF = x[2] - x[1] / ty;
      r.push(["Reflected ray off axis", fmt(dev, 2) + "°"]);
      if (Math.abs(ty) > 1e-4) r.push(["Reflected focus z", fmt(zF, 3)]);
      last.mir = { dev, zF };
    }
  }
  if (St.shape === 52) {
    const fp = G / (2 * St.omega * St.omega);
    const x = g(0, 1),
      d = g(0, 2);
    const ty = d[1] / d[2];
    const zF = x[2] - x[1] / ty;
    const f = Math.abs(zF + 0.03 * St.size) * 1;
    last.liq = { f, fp };
    r.push(
      ["Mirror focus, from rays", fmt(f, 3)],
      ["g/(2 ω²)", fmt(fp, 3)],
      ["Difference", fmt((100 * (f - fp)) / fp, 2) + "%"]
    );
  }
  if (St.shape === 51) {
    const cv = ewCurv(St.volt),
      para_ = para(g, 0, h0);
    const pred = Math.abs(cv) > 1e-3 ? (1 / (cv * (St.n - 1))) * St.size : Infinity;
    r.push(
      ["Contact angle", fmt((Math.acos(-cv) * 180) / Math.PI, 1) + "°"],
      ["Lens f, from rays", para_ && !para_.afocal ? fmt(para_.f, 2) : "none"],
      ["R/(n-1)", Number.isFinite(pred) ? fmt(pred, 2) : "none"]
    );
    last.ew = { f: para_ && para_.f, pred };
  }
  if (St.shape === 50) {
    const dp = dropProfile(St.bond),
      para_ = para(g, 0, h0);
    const pred = (dp.apexR / (St.n - 1)) * St.size;
    r.push(
      ["Drop height", fmt(dp.height, 3)],
      ["Lens f, from rays", para_ && !para_.afocal ? fmt(para_.f, 2) : "none"],
      ["Apex R/(n-1)", fmt(pred, 2)]
    );
    last.drop = { f: para_ && para_.f, pred, height: dp.height };
  }
  if (St.matAlpha && (St.matAlpha[0] || St.matAlpha[1] || St.matAlpha[2]) && t3[3] > 0) {
    const pred = St.absA.map((a) => Math.exp(-a * ((St.wscale || 0.1) / 0.1) * t3[3]));
    r.push(
      ["Transmission, rays", `${fmt(t3[0], 3)} ${fmt(t3[1], 3)} ${fmt(t3[2], 3)}`],
      ["Beer-Lambert", pred.map((v) => fmt(v, 3)).join(" ")]
    );
    last.beer = { meas: [t3[0], t3[1], t3[2]], pred };
  }
  if (polOn(St)) {
    const I = r4[0];
    r.push(["Polariser pass, ray", fmt(I, 4)]);
    last.polI = I;
    if (St.polA && St.polP) {
      const th = ((St.polAa - St.polPa) * Math.PI) / 180,
        mal = 0.5 * Math.cos(th) ** 2;
      r.push(["Malus, ½cos²θ", fmt(mal, 4)]);
      last.malus = { I, mal };
    }
  }
  if (St.view == "walk") r.push(...walkRows());
  if (St.bire && St.shape === 40) {
    const pr = (f) => {
      const q = Object.assign({}, St, { bireF: f });
      const gg = lensProbe(q);
      return gg(0, 1);
    };
    const po = pr(1),
      pe = pr(2);
    const dy = Math.hypot(pe[0] - po[0], pe[1] - po[1]);
    const tt = 2 * mix01(0.08, 0.6, St.curve) * St.size;
    const walk = (Math.atan2(dy, tt) * 180) / Math.PI;
    r.push(["Double image shift", fmt(dy, 4)], ["Walk off", fmt(walk, 2) + "°"]);
    last.dbl = { dy, walk };
  }
  if (St.frame == 15 || St.frame == 13) {
    const op = r4[1] + 0;
    r.push(["Optical path, this ray", fmt(op, 3)]);
  }
  if (St.view == "back" || St.view == "inside") {
    r.push(["Camera in medium", g(0, 4)[3] < 0 ? "yes" : "see picture"]);
  }
  return r;
}
const mix01 = (a, b, t) => a + (b - a) * t;
