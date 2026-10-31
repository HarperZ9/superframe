// SPDX-License-Identifier: FSL-1.1-MIT
import { K_FR4, RHO_CU, RULES, STACKS } from "./constants.js";
import { drc, plantViolations } from "./drc.js";
import { hammerstad, ipc2141 } from "./formulas.js";
import { fieldZ0 } from "./field-solve.js";
import { dcSolve } from "./dc.js";
import { thermalSolve } from "./heat.js";
import { uniformLine } from "./tline.js";
import { exportAll } from "./gerber.js";
import { compareGerber, readExcellon } from "./reader.js";
import { schematic } from "./schematic.js";
import { EXAMPLES, buildGen } from "./examples.js";
// ======================================================================= Known-answer checks. Same functions the views call.
export function miniTrace(w, L, layers) {
  const d = {
    title: "t",
    W: L + 4,
    H: 6,
    layers,
    stack: STACKS[layers],
    rules: RULES[layers],
    holes: [],
    nets: [
      {
        name: "A",
        id: 1,
        kind: "signal",
        width: w,
        pins: [
          ["P", "1"],
          ["Q", "1"],
        ],
      },
    ],
    planes: [],
    vias: [],
    tracks: [{ net: 1, l: 0, x1: 2, y1: 3, x2: 2 + L, y2: 3, w }],
    parts: [],
  };
  const pad = (ref, x) => {
    const q = { pin: "1", x, y: 3, w: 0.6, h: 0.6, th: false, drill: 0, round: false, ref, net: 1 };
    return {
      ref,
      fp: "T",
      value: "",
      P: 0,
      x,
      y: 3,
      rot: 0,
      f: { pads: [q], body: [0.6, 0.6, 0.1], kind: "res" },
      pads: [q],
    };
  };
  d.parts = [pad("P", 2), pad("Q", 2 + L)];
  d.padMap = { "P.1": d.parts[0].pads[0], "Q.1": d.parts[1].pads[0] };
  return d;
}
export function runChecks() {
  const g = checksGen();
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
export function* checksGen(cached) {
  const out = [],
    add = (id, name, got, want, lim, unit, note) => {
      const err = want === 0 ? Math.abs(got) : Math.abs(got - want) / Math.abs(want);
      out.push({ id, name, got, want, err, lim, unit, pass: err <= lim, note: note || "" });
    };
  // 1. Ohm's law on a sheet
  {
    const w = 0.2,
      L = 20,
      d = miniTrace(w, L, 2),
      t = d.stack.cu[0],
      s = dcSolve(d, 1, 0.1, "P.1", "Q.1", 0.05);
    const at = (x) => {
      const r = 0.05,
        i = Math.floor(x / r),
        j0 = Math.floor(3 / r);
      let v = 0,
        c = 0;
      for (let j = j0 - 3; j <= j0 + 3; j++) {
        const q = s.idx.get(s.key(0, i, j));
        if (q !== undefined) {
          v += s.V[q];
          c++;
        }
      }
      return v / c;
    };
    const dV = at(7) - at(17),
      Rn = dV / 0.1,
      Ra = (RHO_CU * 10) / (w * t);
    add(
      "ohm",
      "Trace R, 10 mm of 0.2 mm wide, 1 oz",
      Rn * 1e3,
      Ra * 1e3,
      0.01,
      "mOhm",
      "analytic rho L/(w t), rho 1.724e-8 ohm m"
    );
    add(
      "ohmE",
      "Dissipated power against I squared R on the same solve",
      s.P / (0.1 * 0.1 * s.R),
      1,
      0.01,
      "ratio",
      "false-success control on the solver"
    );
  }
  yield out;
  // 2. Microstrip against Hammerstad and IPC-2141
  for (const [w, h, t, er] of [
    [0.2, 0.1999, 0.0432, 3.61],
    [0.35, 0.1999, 0.0432, 3.61],
    [1, 0.5, 0.0356, 4.5],
    [3, 1.529, 0.0356, 4.5],
    [1.5, 1.529, 0.0356, 4.5],
    [0.2, 1.529, 0.0356, 4.5],
  ]) {
    const f = fieldZ0(w, h, t, er),
      te = (t / Math.PI) * (1 + Math.log((2 * h) / t)),
      H = hammerstad(w + te, h, er).z;
    add(
      "z0_" + w + "_" + h,
      "Z0 field solve, w " + w + ", h " + h + ", er " + er + ", against Hammerstad",
      f.z,
      H,
      0.05,
      "ohm",
      "Hammerstad with Wheeler thickness correction; bare " +
        hammerstad(w, h, er).z.toFixed(1) +
        "; IPC-2141 " +
        ipc2141(w, h, t, er).toFixed(1)
    );
  }
  yield out;
  // 3. RC step
  {
    const Rs = 1000,
      CL = 1e-10,
      tl = uniformLine([{ L: 2, Z0: 50, v: 1.6e8 }], { Rs, CL, RL: 0, dx: 0.5, tr: 0 }),
      line = 2e-3 / (50 * 1.6e8),
      tau = Rs * (CL + line);
    let rms = 0,
      n = 0,
      atT = 0;
    const end = tl.N - 1;
    while (tl.t < 5 * tau) {
      tl.step();
      const a = 1 - Math.exp(-tl.t / tau);
      rms += (tl.V[end] - a) ** 2;
      n++;
      if (!atT && tl.t >= tau) atT = tl.V[end];
    }
    add(
      "rc",
      "RC step, V at t = tau (1k into 100 pF)",
      atT,
      1 - Math.exp(-1),
      0.01,
      "of step",
      "analytic 1 - 1/e; rms over 5 tau " + Math.sqrt(rms / n).toExponential(2)
    );
  }
  yield out;
  // 4. Reflections
  {
    const reflect = (ZL, inf) => {
      const v = 1.6e8,
        L = 60,
        Tf = (L * 1e-3) / v,
        tl = uniformLine([{ L, Z0: 50, v }], {
          Rs: 50,
          RL: inf ? 0 : ZL,
          dx: 0.1,
          tr: 50e-12,
          courant: 0.99,
        }),
        m = tl.N - 1;
      let inc = 0;
      const mid = Math.round(m / 2);
      while (tl.t < 0.9 * Tf) tl.step();
      inc = tl.V[mid];
      while (tl.t < 1.4 * Tf) tl.step();
      return (tl.V[m] - inc) / inc;
    };
    add(
      "gam100",
      "Reflection coefficient, 50 ohm line into 100 ohm",
      reflect(100),
      (100 - 50) / 150,
      0.02,
      "",
      "(ZL-Z0)/(ZL+Z0)"
    );
    add(
      "gam25",
      "Reflection coefficient, 50 ohm line into 25 ohm",
      reflect(25),
      (25 - 50) / 75,
      0.02,
      "",
      ""
    );
    add("gamOpen", "Reflection coefficient, 50 ohm line open", reflect(0, true), 1, 0.02, "", "");
    const v = 1.6e8,
      L = 60,
      Tf = (L * 1e-3) / v,
      tl = uniformLine(
        [
          { L, Z0: 50, v },
          { L, Z0: 75, v },
        ],
        { Rs: 50, RL: 75, dx: 0.1, tr: 50e-12, courant: 0.99 }
      ),
      m = Math.round(L / 0.1),
      sn = Math.round(m / 2);
    while (tl.t < 0.9 * Tf) tl.step();
    const inc = tl.V[sn];
    while (tl.t < 1.5 * Tf) tl.step();
    const after = tl.V[Math.round(m * 1.25)];
    add(
      "gam75",
      "Transmission past a 50 to 75 ohm step",
      after / inc,
      1 + 0.2,
      0.02,
      "",
      "1 + (75-50)/(75+50)"
    );
    const fl = uniformLine([{ L, Z0: 50, v }], { Rs: 50, RL: 50, dx: 0.1, tr: 0, courant: 0.99 });
    let cross = 0;
    while (fl.t < 2 * Tf && !cross) {
      fl.step();
      if (fl.V[fl.N - 1] > 0.25) cross = fl.t;
    }
    add(
      "flight",
      "Flight time on 60 mm at 1.6e8 m/s",
      cross * 1e12,
      Tf * 1e12,
      0.03,
      "ps",
      "L / v"
    );
  }
  yield out;
  // 5. Fin
  {
    const W = 20,
      L = 200,
      Kk = K_FR4,
      tDiel = 1.529,
      d = { W: L, H: W, layers: 2, stack: STACKS[2], parts: [], planes: [] },
      h = 10,
      Q = 0.5,
      r = thermalSolve(d, { h, res: 0.25, sources: [[L / 2 + 0.05, 0, L / 2 + 0.2, W, Q]] }),
      kt = Kk * tDiel * 1e-3,
      m = Math.sqrt((2 * h) / kt),
      T0 = Q / (2 * kt * (W * 1e-3) * m);
    add(
      "fin",
      "Peak rise, 0.5 W line source, long FR4 strip, h = 10",
      r.max,
      T0,
      0.03,
      "K",
      "fin: Q/(2 k t W m), m = sqrt(2h/kt) = " + m.toFixed(1) + " per m"
    );
    add(
      "finE",
      "Heat lost through the faces against power in",
      r.balance,
      Q,
      0.01,
      "W",
      "energy balance control"
    );
  }
  yield out;
  // 6. DRC
  {
    const clean = {};
    for (const k of ["tia", "piezo", "honeycomb", "sunflower"]) {
      let b = cached && cached(k);
      if (!b) b = yield* buildGen(EXAMPLES[k]);
      clean[k] = b;
      yield out;
      add(
        "clean_" + k,
        k + ": violations on the generated board",
        b.drc.length,
        0,
        0,
        "count",
        b.drc
          .slice(0, 3)
          .map((v) => v.rule + ": " + v.msg)
          .join("; ") || "clean; " + b.rules.name
      );
    }
    const b4 = clean.tia,
      b2 = clean.piezo;
    for (const pv of plantViolations(b4)) {
      const v = drc(pv.d),
        hit = v.some((q) => q.rule === pv.rule);
      add(
        "plant_" + pv.name,
        "Planted, " + pv.name + ": caught under rule " + pv.rule,
        hit ? 1 : 0,
        1,
        0,
        "",
        v.length + " total reported"
      );
    }
    // 7. Gerber round trip
    for (const [nm, d] of [
      ["tia", b4],
      ["piezo", b2],
      ["honeycomb", clean.honeycomb],
    ]) {
      const F = exportAll(d),
        names = d.layers === 2 ? ["F_Cu", "B_Cu"] : ["F_Cu", "In1_Cu", "In2_Cu", "B_Cu"];
      let bad = 0,
        mx = 0;
      names.forEach((n, l) => {
        const c = compareGerber(d, l, F[n + ".gbr"]);
        bad += c.missT + c.missF + c.extraT + c.extraF + Math.abs(c.clears - c.wantClears);
        mx = Math.max(mx, c.maxe);
      });
      const dh = readExcellon(F["PTH.drl"]),
        wantH = d.vias.length + d.parts.reduce((a, p) => a + p.pads.filter((q) => q.th).length, 0);
      add(
        "gerber_" + nm,
        nm + ": Gerber read back, mismatched items over all copper layers",
        bad,
        0,
        0,
        "count",
        "max position error " + (mx * 1e3).toFixed(2) + " um; reader written apart from the writer"
      );
      add("drill_" + nm, nm + ": Excellon holes read back", dh.length, wantH, 0, "holes", "");
    }
    {
      const s = schematic(b4);
      add("schem", "TIA schematic: pins left unwired", s.unconnected.length, 0, 0, "count", "");
    }
  }
  return out;
}
