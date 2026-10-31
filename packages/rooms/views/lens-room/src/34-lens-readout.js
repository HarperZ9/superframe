let last = {};
function measureLens() {
  const St = S;
  const g = lensProbe(St);
  const h0 = (0.5 / 12) * 1.1 * St.size;
  const foc = (off) => {
    const ax = off ? 0 : 1,
      zs = [];
    let retro = 0,
      lost = 0,
      hit = 0,
      conv = 0,
      div = 0,
      str = 0;
    for (let k = 0; k < 12; k++) {
      const e = g(k + off, 0),
        x = g(k + off, 1),
        d = g(k + off, 2);
      if (e[3] == 0) continue;
      hit++;
      if (x[3] < 0 || e[3] < 0) {
        lost++;
        continue;
      }
      if (d[2] < 0) {
        retro++;
        continue;
      }
      const ty = d[ax] / d[2];
      if (Math.abs(ty) < 1e-3) {
        str++;
        continue;
      }
      const z = x[2] - x[ax] / ty;
      if (ty < 0 && z > x[2] - 0.03) {
        conv++;
        zs.push(z);
      } else div++;
    }
    return { zs, retro, lost, hit, conv, div, str };
  };
  const a = foc(0),
    b = foc(12);
  const kind =
    a.hit == 0
      ? "rays miss it"
      : a.retro > a.hit / 2
        ? "sends light back"
        : a.lost > a.hit / 2
          ? "traps light"
          : a.conv && a.div
            ? "mixed: some focus, some spread"
            : a.conv > a.str
              ? "converging"
              : a.div > a.str
                ? "spreading"
                : "passes straight";
  const fz = (r) => (r.zs.length && !r.div && r.retro <= r.hit / 2 ? r.zs[0].toFixed(2) : "none");
  const spread =
    a.zs.length > 1 && !a.div ? (Math.max(...a.zs) - Math.min(...a.zs)).toFixed(2) : "none";
  const rows = [
    ["Action", St.mat ? "mirror: " + kind : kind],
    ["Focus, height rays", fz(a)],
    ["Focus, width rays", fz(b)],
    ["Focus spread", spread],
    ["Sent back", a.retro + " of " + a.hit],
    ["Trapped", a.lost + " of " + a.hit],
  ];
  last.lens = { g, a, b };
  const t3 = g(0, 3);
  const r4 = g(0, 4);
  if (St.two) {
    const pA = para(lensProbe(St, 1, 0), 0, h0),
      pB = para(lensProbe(St, 2, 1), 1, h0),
      pAB = para(g, 0, h0);
    last.stack = null;
    if (pA && pB && !pA.afocal && !pB.afocal) {
      const fa = pA.f,
        fb = pB.f,
        d = pB.H - pA.H,
        fS = 1 / (1 / fa + 1 / fb - d / (fa * fb)),
        bfd = fS * (1 - d / fa),
        zS = pB.H + 0; // pB.H here is the front plane of B, used for d.
      const pBfwd = para(lensProbe(St, 2, 0), 0, h0);
      const zHb = pBfwd ? pBfwd.H : pB.H;
      const zFs = zHb + bfd;
      const fThin = 1 / (1 / fa + 1 / fb - St.sp / (fa * fb));
      rows.push(
        ["Lens 1 alone f", fmt(fa)],
        ["Lens 2 alone f", fmt(fb)],
        ["Principal gap d", fmt(d)],
        ["Stack f, formula", Math.abs(fS) > 60 ? "afocal" : fmt(fS)]
      );
      if (pAB && !pAB.afocal) {
        const afo = Math.abs(pAB.f) > 60;
        rows.push(["Stack f, measured", afo ? "afocal" : fmt(pAB.f)]);
        if (!afo)
          rows.push(
            ["Difference", fmt((100 * (pAB.f - fS)) / fS, 2) + "%"],
            ["Focus z, formula", fmt(zFs)],
            ["Focus z, measured", fmt(pAB.zF)],
            ["Thin lens f, centre gap", fmt(fThin)]
          );
      }
      if (pAB) rows.push(["Beam height out/in", fmt(pAB.h1 / h0, 3)]);
      last.stack = {
        fa,
        fb,
        d,
        fS,
        fThin,
        zFs,
        mf: pAB && pAB.f,
        mz: pAB && pAB.zF,
        ratio: pAB && pAB.h1 / h0,
      };
    }
  } else {
    last.stack = null;
    const r = para(g, 0, h0);
    if (r && !r.afocal) {
      rows.push(["Paraxial f", Math.abs(r.f) > 500 ? "none" : fmt(r.f)]);
    }
  }
  if (St.mat == 0)
    rows.push(["Path in glass, height 1", fmt(t3[3], 3)], ["Optical path", fmt(r4[1], 3)]);
  rows.push(...extraRows(g, t3, r4, h0));
  setRead(rows);
  if (!$("sideD").open && S.view != "side") return;
  drawSection(g);
}
function setRead(rows, extra) {
  $("read").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  last.rows = rows;
}
