// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/sim/stamp: element stamps for the real system (DC and each transient step) and the complex system
   (AC and noise). Sign convention: a branch current flows from n[0] through the element to n[1]; a row of the
   node equations is the sum of currents leaving that node. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const S = (D.SIM = D.SIM || {});

  const mk = (n) => ({ A: new Float64Array(n * n), b: new Float64Array(n), n });
  const addA = (M, i, j, v) => { if (M.A && i >= 0 && j >= 0) M.A[i * M.n + j] += v; };
  const addB = (M, i, v) => { if (i >= 0) M.b[i] += v; };
  const cond = (M, a, b, gv) => { addA(M, a, a, gv); addA(M, b, b, gv); addA(M, a, b, -gv); addA(M, b, a, -gv); };
  const branchKCL = (M, e) => { addA(M, e.i[0], e.br, 1); addA(M, e.i[1], e.br, -1); };
  const vdiff = (M, row, a, b, k) => { addA(M, row, a, k); addA(M, row, b, -k); };
  S._real = { mk, addA, addB, cond };

  /* ctx: { t, x (Newton guess), dt, method: "be" | "trap" | "bdf2" | null (DC), h (history per element), noise } */
  S.assembleReal = (ck, ctx) => {
    const M = ctx.bOnly ? { A: null, b: new Float64Array(ck.size), n: ck.size } : mk(ck.size), tr = !!ctx.method, dt = ctx.dt, m = ctx.method;
    for (const e of ck.elements) {
      const [a, b] = e.i, h = ctx.h ? ctx.h.get(e) : null, inj = ctx.noise ? ctx.noise.get(e) || 0 : 0;
      switch (e.t) {
        case "R": cond(M, a, b, 1 / e.R); if (inj) { addB(M, a, -inj); addB(M, b, inj); } break;
        case "S": cond(M, a, b, 1 / S.switchR(e, ctx.t || 0)); if (inj) { addB(M, a, -inj); addB(M, b, inj); } break;
        case "C": {
          if (!tr) break;
          const [geq, hist] = m === "trap" ? [2 * e.C / dt, 2 * e.C / dt * h.v + h.i] : m === "bdf2" ? [1.5 * e.C / dt, e.C * (4 * h.v - h.v1) / (2 * dt)] : [e.C / dt, e.C / dt * h.v];
          cond(M, a, b, geq); addB(M, a, hist); addB(M, b, -hist); break;
        }
        case "L": {
          branchKCL(M, e); vdiff(M, e.br, a, b, 1);
          if (!tr) break;
          const L = e.L, [k, rhs] = m === "trap" ? [2 * L / dt, -(2 * L / dt) * h.i - h.v] : m === "bdf2" ? [1.5 * L / dt, -L * (4 * h.i - h.i1) / (2 * dt)] : [L / dt, -(L / dt) * h.i];
          addA(M, e.br, e.br, -k); M.b[e.br] += rhs; break;
        }
        case "V": branchKCL(M, e); vdiff(M, e.br, a, b, 1); M.b[e.br] += (tr || ctx.t !== undefined ? S.srcValue(e, ctx.t || 0) : e.dc || 0) + inj; break;
        case "I": { const I = (tr || ctx.t !== undefined ? S.srcValue(e, ctx.t || 0) : e.dc || 0) + inj; addB(M, a, -I); addB(M, b, I); break; }
        case "E": branchKCL(M, e); vdiff(M, e.br, a, b, 1); vdiff(M, e.br, e.ci[0], e.ci[1], -e.gain); break;
        case "G": addA(M, a, e.ci[0], e.gm); addA(M, a, e.ci[1], -e.gm); addA(M, b, e.ci[0], -e.gm); addA(M, b, e.ci[1], e.gm); break;
        case "D": {
          const [I, gd, v] = S.diodeI(e, ctx.x), ieq = I - gd * v;
          cond(M, a, b, gd); addB(M, a, -ieq); addB(M, b, ieq);
          if (inj) { addB(M, a, -inj); addB(M, b, inj); }
          break;
        }
        default: throw new Error("sim: no stamp for " + e.t);
      }
    }
    if (ctx.gmin && M.A) for (let i = 0; i < ck.nN; i++) M.A[i * M.n + i] += ctx.gmin;
    return M;
  };

  /* Complex system at angular frequency w, linearised about the operating point op ({ x, t }). */
  S.assembleC = (ck, w, op) => {
    const n = ck.size, Ar = new Float64Array(n * n), Ai = new Float64Array(n * n), br = new Float64Array(n), bi = new Float64Array(n);
    const ar = (i, j, v) => { if (i >= 0 && j >= 0) Ar[i * n + j] += v; }, ai = (i, j, v) => { if (i >= 0 && j >= 0) Ai[i * n + j] += v; };
    const cr = (a, b, v) => { ar(a, a, v); ar(b, b, v); ar(a, b, -v); ar(b, a, -v); }, ci = (a, b, v) => { ai(a, a, v); ai(b, b, v); ai(a, b, -v); ai(b, a, -v); };
    const kcl = (e) => { ar(e.i[0], e.br, 1); ar(e.i[1], e.br, -1); ar(e.br, e.i[0], 1); ar(e.br, e.i[1], -1); };
    for (const e of ck.elements) {
      const [a, b] = e.i;
      switch (e.t) {
        case "R": cr(a, b, 1 / e.R); break;
        case "S": cr(a, b, 1 / S.switchR(e, op.t || 0)); break;
        case "C": ci(a, b, w * e.C); break;
        case "L": kcl(e); ai(e.br, e.br, -w * e.L); break;
        case "V": kcl(e); if (e.ac) { br[e.br] += e.ac * Math.cos(e.acPh || 0); bi[e.br] += e.ac * Math.sin(e.acPh || 0); } break;
        case "I": if (e.ac) { const re = e.ac * Math.cos(e.acPh || 0), im = e.ac * Math.sin(e.acPh || 0); if (a >= 0) { br[a] -= re; bi[a] -= im; } if (b >= 0) { br[b] += re; bi[b] += im; } } break;
        case "E": kcl(e); ar(e.br, e.ci[0], -e.gain); ar(e.br, e.ci[1], e.gain); break;
        case "G": ar(a, e.ci[0], e.gm); ar(a, e.ci[1], -e.gm); ar(b, e.ci[0], -e.gm); ar(b, e.ci[1], e.gm); break;
        case "D": cr(a, b, S.diodeI(e, op.x)[1]); if (e.Cj) ci(a, b, w * e.Cj); break;
        default: throw new Error("sim: no AC stamp for " + e.t);
      }
    }
    return { Ar, Ai, br, bi, n };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = S;
})(typeof globalThis !== "undefined" ? globalThis : this);
