// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Known-answer tests for the diagram engine.  node tests/engine.test.js [--json out.json]
   Exit 1 if a check fails or a planted wrong value is accepted. Each block plants one bad input and requires
   the same check to reject it, so a check that accepts anything fails. */
"use strict";
const path = require("path"), fs = require("fs");
require("../../ndim/src/index.js");
require("../../perceive/src/index.js");
for (const f of ["core", "mesh", "model", "section", "raster", "scene", "lens", "layout", "spacetime", "overlay", "charts"]) require("../src/" + f + ".js");
const D = globalThis.Diagram, N = globalThis.NDim, P = globalThis.Perceive;
const IDS = ["wien", "cesium", "sampling", "cordic", "gpib", "guard", "trace"].filter((i) => fs.existsSync(path.join(__dirname, "../diagrams/" + i + ".js")));
for (const i of IDS) require("../diagrams/" + i + ".js");
const DEFS = globalThis.DiagramDefs, LIB = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/materials.json"), "utf8")).materials;
const TOK = { ink: "#16130f", soft: "#4a443b", line: "#c4baa6", wall: "#e8e3d9", wall2: "#ddd6c9", mat: "#f3efe6", red: "#c8322b", ochre: "#d79e35", s1: "#c8322b", s2: "#1d2562", s3: "#94640f", s4: "#151314", s5: "#b4491a", tide: "#2f4a8f", verified: "#0a6b61", drift: "#8f3a19", mono: "monospace" };

const out = { pass: 0, fail: 0, planted_rejected: 0, planted_accepted: 0, rows: [] };
const check = (name, ok, detail) => { out[ok ? "pass" : "fail"]++; out.rows.push({ name, ok: !!ok, detail }); if (!ok) console.error("FAIL", name, detail || ""); };
const planted = (name, accepted, detail) => { out[accepted ? "planted_accepted" : "planted_rejected"]++; out.rows.push({ name: "planted: " + name, ok: !accepted, detail }); if (accepted) console.error("PLANTED ACCEPTED", name, detail || ""); };
const close = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const rel = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);
const bits = (a) => Buffer.from(Float64Array.from(a).buffer).toString("hex");
const view0 = (m, extra) => Object.assign({ explode: 0, cut: { on: false, n: [0, 0, 1], d: 0 }, tokens: TOK, lib: LIB, knobs: {}, opacity: {} }, extra || {});

/* 1. mesh winding: signed volume equals the analytic solid */
{
  const vol = (g) => D.meshVolume(Float64Array.from(D.build(g).pos)), ngon = (r, n) => 0.5 * n * r * r * Math.sin((2 * Math.PI) / n);
  check("box volume", close(vol({ t: "box", size: [2, 3, 4] }), 24, 1e-12));
  check("cylinder volume (64-gon prism)", close(vol({ t: "cyl", r: 1, h: 2, seg: 64 }), 2 * ngon(1, 64), 1e-12));
  check("tube volume", close(vol({ t: "tube", r: 1, r0: 0.5, h: 2, seg: 48 }), 2 * (ngon(1, 48) - ngon(0.5, 48)), 1e-12));
  check("shell volume (outer minus cavity)", close(vol({ t: "shell", size: [4, 2, 2], wall: 0.1 }), 16 - 3.8 * 1.8 * 1.8, 1e-12));
  const U = [[-1.4, -0.6], [-1, -0.6], [-1, 0.5], [1, 0.5], [1, -0.6], [1.4, -0.6], [1.4, 0.9], [-1.4, 0.9]];
  check("non-convex extrusion volume", close(vol({ t: "extrude", profile: U, depth: 0.6 }), D.polyArea(U) * 0.6, 1e-12));
  planted("inward-wound box passes as positive volume", vol({ t: "box", size: [2, 3, 4] }) * -1 > 0);
}

/* 2. section area against the analytic value */
{
  const sec = (g, n, d) => D.section(Float64Array.from(D.build(g).pos), n, d).area;
  check("box cut across z: w h", close(sec({ t: "box", size: [2, 3, 4] }, [0, 0, 1], 0.37), 6, 1e-12));
  check("box cut across x: h d", close(sec({ t: "box", size: [2, 3, 4] }, [1, 0, 0], -0.21), 12, 1e-12));
  const n = 64, poly = 0.5 * n * Math.sin((2 * Math.PI) / n);
  check("cylinder cut across its axis: the 64-gon's area", close(sec({ t: "cyl", r: 1, h: 2, seg: n, axis: "x" }, [1, 0, 0], 0.3), poly, 1e-12), poly);
  check("cylinder area within faceting error of pi r^2", Math.abs(poly - Math.PI) / Math.PI < 2e-3);
  const an = 0.5 * 48 * Math.sin((2 * Math.PI) / 48) * (1 - 0.25);
  check("tube cut: annulus (cavity wound the other way)", close(sec({ t: "tube", r: 1, r0: 0.5, h: 2, seg: 48 }, [0, 1, 0], 0.2), an, 1e-12));
  check("tube cut along its axis: two strips", close(sec({ t: "tube", r: 1, r0: 0.5, h: 2, seg: 48 }, [1, 0, 0], 0), 2, 1e-9));
  check("shell cut: frame area", close(sec({ t: "shell", size: [4, 2, 2], wall: 0.1 }, [0, 0, 1], 0.3), 8 - 3.8 * 1.8, 1e-12));
  planted("annulus area accepted as the full disc", close(sec({ t: "tube", r: 1, r0: 0.5, h: 2, seg: 48 }, [0, 1, 0], 0.2), an / 0.75, 1e-6));
}

/* 3. every diagram: labels, round trip, determinism, layout */
for (const id of IDS) {
  const def = DEFS[id];
  check(id + ": every part has a label and a text alternative", D.validate(def).length === 0 && def.parts.every((p) => p.label.trim() && p.alt.trim()), D.validate(def).join("; "));
  const M = D.compile(def), sim = def.sim ? def.sim(M) : null;
  let exact = true;
  for (const Pt of M.parts) for (const s of [0.13, 0.5, 1, 0.371]) { const q = D.exploded(Pt, s), back = D.assembled(Pt, q, s); if (bits(back) !== bits(Pt.pos)) exact = false; }
  check(id + ": exploded and assembled poses round-trip bit for bit", exact);
  const h0 = D.hash(new Uint8Array(D.drawList(M, view0(M)).tris.buffer));
  let v = view0(M);
  for (const s of [0.2, 1, 0.55]) { v = view0(M, { explode: s }); D.drawList(M, v); }
  check(id + ": the slider back at 0 gives the assembled triangles", D.hash(new Uint8Array(D.drawList(M, view0(M, { explode: 0 })).tris.buffer)) === h0);
  if (sim) {
    const cam = D.camera(D.homeCamera(M, def.camera), 320, 200), V = view0(M, { cut: { on: true, n: [0, 0, 1], d: M.mid[2] } });
    const fr = (u) => D.hash(D.raster(D.frame(M, sim, u, V), cam).rgba);
    const a = fr(0.4); fr(0.9); fr(0.1);
    check(id + ": same t gives the same frame bytes", fr(0.4) === a, a);
    if (sim.spacetime) {
      const F = D.spacetimeFit(sim.spacetime()), rot = N.rotationFromAngles(4, F.angles || [0, 0, 0, 0, 0, 0]);
      check(id + ": 4D turn is a rotation", N.orthogonalityError(rot) < 1e-12);
      check(id + ": the slice at mid time finds the instant", D.spacetimeSlice(F, (F.lo[3] + F.hi[3]) / 2).pts.length > 0);
    }
  }
  const pos = D.placement(def), seen = new Set();
  let clash = false;
  for (const c of pos.values()) { const k = c[0] + "," + c[1]; if (seen.has(k)) clash = true; seen.add(k); }
  check(id + ": no two schematic blocks share a place", !clash);
  for (const c of def.checks ? def.checks(M, sim) : []) check(id + ": " + c.name, c.want === 0 ? Math.abs(c.got) <= c.tol : rel(c.got, c.want, c.tol), `got ${c.got} want ${c.want}`);
}
{
  const bad = JSON.parse(JSON.stringify({ id: "bad", parts: [{ id: "a", label: "A", alt: "a block", fn: "x", geom: { t: "box", size: [1, 1, 1] } }, { id: "b", label: "", alt: "a block with no label", fn: "x", geom: { t: "box", size: [1, 1, 1] } }] }));
  let threw = false;
  try { D.compile(bad); } catch (e) { threw = /no label/.test(e.message); }
  check("a part with no label is refused, and the error names it", threw);
  planted("model with an unlabelled part validates", D.validate(bad).length === 0);
  const noalt = { id: "bad2", parts: [{ id: "a", label: "A", fn: "x", geom: { t: "box", size: [1, 1, 1] } }] };
  planted("model with a part lacking a text alternative validates", D.validate(noalt).length === 0);
}

/* 4. physics layers */
{
  const sb = 5.670374419e-8, T = 1500, full = D.bandRadiance(T, 5e-8, 1e-3, 20000);
  check("band integrator: all wavelengths give sigma T^4 / pi (Stefan-Boltzmann)", rel(full, (sb * T ** 4) / Math.PI, 2e-3), full);
  if (DEFS.wien) {
    const M = D.compile(DEFS.wien), sim = DEFS.wien.sim(M), Tf = sim.state(0.95, view0(M)).parts.lamp.temp, peak = P.wienPeak(Tf);
    check("thermal: the filament's Planck peak sits at Wien's b / T", rel(peak, 2.897771955e-3 / Tf, 1e-3), `T = ${Tf.toFixed(1)} K, peak ${(peak * 1e6).toFixed(3)} um`);
    planted("filament peak accepted at b / (2T)", rel(peak, 2.897771955e-3 / (2 * Tf), 1e-3));
    const oc = D.overlayContext(M, view0(M, { state: sim.state(0.95, view0(M)) }), "thermal").readings.get("lamp");
    check("thermal camera: polished tungsten reads far below its true temperature", oc.Tapp < oc.T - 200, `${oc.Tapp.toFixed(0)} K apparent, ${oc.T.toFixed(0)} K true`);
  }
  /* ohmic heating: a stepped copper conductor; P from slicing along its length equals I^2 R */
  const sig = LIB.copper.sigma.value, I = 2.5, r1 = 1e-3, r2 = 0.5e-3, L1 = 0.03, L2 = 0.02, seg = 256;
  const geom = { t: "group", items: [{ t: "cyl", r: r1, h: L1, axis: "x", seg, pos: [L1 / 2, 0, 0] }, { t: "cyl", r: r2, h: L2, axis: "x", seg, pos: [L1 + L2 / 2, 0, 0] }] };
  const pos = Float64Array.from(D.build(geom).pos), steps = 500;
  let Pslice = 0;
  for (let k = 0; k < steps; k++) { const x = ((k + 0.5) / steps) * (L1 + L2), A = D.section(pos, [1, 0, 0], x).area; Pslice += ((I * I) / (sig * A)) * ((L1 + L2) / steps); }
  const ngon = (r) => 0.5 * seg * r * r * Math.sin((2 * Math.PI) / seg), Pclosed = I * I * (L1 / (sig * ngon(r1)) + L2 / (sig * ngon(r2)));
  check("conductivity: integral of J^2 / sigma over the volume equals I^2 R", rel(Pslice, Pclosed, 1e-7), `${Pslice} W vs ${Pclosed} W`);
  planted("I R accepted for the power", rel(Pslice, I * (L1 / (sig * ngon(r1)) + L2 / (sig * ngon(r2))), 1e-6));
  const ew = LIB.tungsten.emissivity_lwir, fr = (n, k) => 1 - ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k);
  check("emissivity copied from the measured table equals 1 - R from its own n, k (Kirchhoff)", close(ew.value, fr(ew.n, ew.k), 2e-3), ew.value);
  const kh = Math.sqrt(LIB.tungsten.sigma.value / (2 * 8.8541878188e-12 * 2 * Math.PI * 299792458 / 1e-5)), hr = fr(kh, kh);
  check("measured tungsten emissivity sits below the Hagen-Rubens limit at 10 um (Ordal 1988 against the free-electron limit)", ew.value < hr && ew.value > 0.5 * hr, `${ew.value} vs ${hr.toFixed(4)}`);
  planted("Hagen-Rubens value accepted as the measured one", close(ew.value, hr, 2e-3));
  if (DEFS.wien) {
    const tw = DEFS.wien.tempW;
    check("tungsten table: R / R(296 K) = 4.565 inverts to 1000 K (Desai 1984 Table 5)", Math.abs(tw(4.565) - 1000) < 1, tw(4.565));
    planted("linear alpha = 4.5e-3 accepted for a 1000 K filament", Math.abs(296 + 3.565 / 4.5e-3 - 1000) < 1);
  }
  const cu = LIB.copper.drude, me = 9.1093837139e-31, q = 1.602176634e-19;
  check("Drude: n e^2 tau / m from the library returns its DC conductivity", close((cu.n_e * q * q * cu.tau_s) / me, sig, 2e-3));
}
/* 5. lens: the schematic keeps less of where things are than the assembled 3D view */
if (DEFS.wien) {
  const M = D.compile(DEFS.wien), cam = D.homeCamera(M, DEFS.wien.camera), V = view0(M);
  const b3 = D.lensBits(M, V, "model", cam), bs = D.lensBits(M, V, "schematic", cam), bx = D.lensBits(M, Object.assign({}, V, { xray: true }), "xray", cam);
  const xs = M._samples.map((q) => q.p.map((x) => Math.floor(x / (M.radius / 24))).join(","));
  check("lens: a view that keeps every voxel loses 0 bits", D.condBits(xs, xs).lost === 0);
  check("lens: a view that keeps nothing loses all the source bits", rel(D.condBits(xs, xs.map(() => "x")).lost, D.condBits(xs, xs).source, 1e-12));
  check("lens: the schematic loses more of where things are than the 3D model", bs.lost > b3.lost, `${bs.lost.toFixed(2)} vs ${b3.lost.toFixed(2)}`);
  check("lens: occlusion costs bits: the opaque model loses more than the x-ray", b3.lost > bx.lost, `${b3.lost.toFixed(2)} vs ${bx.lost.toFixed(2)}`);
  check("lens: bits lost lie between 0 and the source entropy", [b3, bs, bx].every((b) => b.lost >= 0 && b.lost <= b.source + 1e-9), `model ${b3.lost.toFixed(2)}, schematic ${bs.lost.toFixed(2)}, x-ray ${bx.lost.toFixed(2)} of ${b3.source.toFixed(2)}`);
  out.lens = { model: b3, schematic: bs, xray: bx };
  planted("schematic reported as lossless", bs.lost === 0);
}

console.log(`diagram engine: ${out.pass} pass, ${out.fail} fail, planted ${out.planted_rejected} rejected, ${out.planted_accepted} accepted`);
const j = process.argv.indexOf("--json");
if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(Object.assign({ date: new Date().toISOString().slice(0, 10) }, out), null, 1));
process.exit(out.fail || out.planted_accepted ? 1 : 0);
