// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* The thermometer's whole chain from one model: schematic netlist, then simulation against the spec sheet,
   then the board (place, route, pour, DRC), the board's copper back into the simulation, the fab files with their
   round trips, the Gerbers rendered back against the board view, and the 3D board render.
     node eda/run-jnt.js [--quick]     writes eda/out/jnt/*, eda/data/jnt-chain.json, $RENDER_OUT/eda/*.png */
"use strict";
const fs = require("fs"), path = require("path");
const { D, C, E } = require("./load.js");
const J = require("../sim/jnt-chain.js");
const { circuit } = require("../sim/jnt.js");
const { build } = require("./jnt-board.js");
const { writeAll, compareLayer } = require("./fab.js");
const OUT = path.join(__dirname, "out", "jnt"), FAR = path.join(process.env.RENDER_OUT || path.join(__dirname, "out"), "eda"), DATA = path.join(__dirname, "data");
const MAT = JSON.parse(fs.readFileSync(path.join(DATA, "board-materials.json"), "utf8"));
const quick = process.argv.includes("--quick");

const png = async (file, w, h, rgba) => { const { encodePNG } = await import("../../../playbook/lib/png.js"); const b = encodePNG(w, h, rgba); for (const d of [OUT, FAR]) fs.writeFileSync(path.join(d, file), b); return path.join(FAR, file); };
const maskRGBA = (M, on, off) => { const o = new Uint8ClampedArray(M.W * M.H * 4); for (let k = 0; k < M.W * M.H; k++) { const c = M.m[k] ? on : off; o[k * 4] = c[0]; o[k * 4 + 1] = c[1]; o[k * 4 + 2] = c[2]; o[k * 4 + 3] = 255; } return o; };

/* trace copper resistance per net: length / (sigma * width * thickness) */
const traceR = (B) => {
  const s = MAT.copper_sigma.value, t = MAT.copper_thickness_m.value, out = {};
  for (const tr of B.traces) { const L = Math.hypot(tr.b[0] - tr.a[0], tr.b[1] - tr.a[1]) * 1e-3; out[tr.net] = (out[tr.net] || 0) + L / (s * tr.w * 1e-3 * t); }
  return out;
};

const main = async () => {
  for (const d of [OUT, FAR]) fs.mkdirSync(d, { recursive: true });
  const t0 = Date.now(), R = C.resolve(C.REG.jnt), v = R.phys.v, res = { date: new Date().toISOString().slice(0, 10), model_hash: R.hash, params: R.p };
  /* simulation */
  const G = J.gain(R), Z = 1 - J.reZ(R, R.p.fHi), Bu = J.budget(R), St = J.settle(R);
  const Ron = J.ASSUMED.ron.value, x = 2 * Math.PI * R.p.fHi * (R.p.R + Ron) * R.p.Cin * 1e-12;
  res.sim = {
    gain: { peak: G.peak, g1k: G.g1k, g3k: G.g3k, gTop: G.g10k, lo3: G.lo3, hi3: G.hi3, fHPfromNetlist: G.fHPnet, spec: { G: v.G, fHP: R.inst.fixed.fHP } },
    reZdroop: { sim: Z, spec: v.droop, withContact: 1 - ((R.p.R + Ron) / R.p.R) / (1 + x * x) },
    budget: Object.assign({}, Bu, { spec: { a: v.a, corr: v.corr, rel: v.rel, eR: v.eR, vout: v.vout } }),
    settle: { sim: St.settle, spec: v.settle, peak: St.peak },
    curves: { fs: G.fs.filter((_, k) => k % 2 === 0), mag: G.mag.filter((_, k) => k % 2 === 0), settle: St.trace },
    assumed: J.ASSUMED,
  };
  res.sim.thermometry = await J.thermometry(R, { nseg: quick ? 32 : 256 });
  console.log("sim done", Date.now() - t0, "ms");
  /* board */
  const { B } = build();
  const meta = { hash: R.hash }, W = writeAll(B, meta), drc = E.drc(B);
  const tr = traceR(B), Bu2 = J.budget(R, { traceR: { IN: tr.IN || 0 } });
  res.board = { w: B.w, h: B.h, parts: B.parts.length, nets: Object.keys(B.nets).length, traces: B.traces.length, vias: B.vias.length, pourRects: B.pourRects.length, routeLog: B.routeLog, drc: { errors: drc.errors.length, counts: drc.counts, objects: drc.objects, pairs: drc.pairs }, traceR: tr,
    backAnnotated: { a: Bu2.a, aWithout: Bu.a, inTraceOhms: tr.IN || 0, rel: Bu2.relSpecForm } };
  res.fab = { trips: W.trips, files: {} };
  for (const [name, txt] of Object.entries(W.files)) { fs.writeFileSync(path.join(OUT, name), txt); res.fab.files[name] = { bytes: txt.length, hash: C.hashText(txt) }; }
  fs.writeFileSync(path.join(OUT, "jnt.cir"), require("../sim/load.js").S.toSpice(circuit(R), "Johnson-noise thermometer, from cad/instruments/jnt.js netlist"));
  fs.writeFileSync(path.join(OUT, "board.svg"), `<?xml version="1.0" encoding="UTF-8"?>\n` + E.boardSVG(B).replace("<svg ", `<svg width="${B.w * 4}" height="${B.h * 4}" `).replace(">", `><style>${E.BOARD_SVG_CSS}</style>`));
  /* Gerbers rendered back against the board view */
  res.compare = {};
  const renders = {};
  for (const [L, name] of [[0, "F_Cu"], [1, "B_Cu"]]) {
    const K = compareLayer(B, W.files[`jnt-${name}.gbr`], L);
    res.compare[name] = { xor: K.xor, copper: K.copper, frac: K.frac, thick: K.thick, ppm: 25 };
    renders[name] = [await png(`board-view-${name}.png`, K.view.W, K.view.H, maskRGBA(K.view, [200, 50, 43], [244, 241, 234])), await png(`gerber-back-${name}.png`, K.back.W, K.back.H, maskRGBA(K.back, [29, 37, 98], [244, 241, 234])), await png(`diff-${name}.png`, K.view.W, K.view.H, maskRGBA({ W: K.view.W, H: K.view.H, m: K.mask }, [21, 19, 20], [255, 255, 255]))];
  }
  /* 3D renders through the engine's software raster */
  const list = E.boardDrawList(B, MAT), shots = [["board-3d-top.png", { yaw: 0.0001, pitch: 1.5, zoom: 1.0 }], ["board-3d-angle.png", { yaw: 0.55, pitch: 0.62, zoom: 0.95 }], ["board-3d-bottom.png", { yaw: 0.4, pitch: -0.9, zoom: 1.0 }], ["board-3d-bare.png", { yaw: 0.55, pitch: 0.62, zoom: 0.95 }, { mask: false, bodies: false }]];
  renders.threeD = [];
  for (const [file, cam, o] of shots) {
    const lst = o ? E.boardDrawList(B, MAT, o) : list, c = D.camera(E.boardCamera(B, cam), 1600, 1000), img = D.raster(lst, c, { bg: [0.957, 0.945, 0.918] });
    renders.threeD.push(await png(file, img.w, img.h, img.rgba));
  }
  res.renders = renders;
  res.seconds = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(DATA, "jnt-chain.json"), JSON.stringify(res, (k, val) => (val instanceof Float64Array || val instanceof Float32Array ? Array.from(val) : val), 1));
  fs.writeFileSync(path.join(DATA, "jnt-board.json"), JSON.stringify(boardRecord(B)));
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ id: "jnt", model_hash: R.hash, files: res.fab.files, drc: res.board.drc, trips: W.trips }, null, 1));
  console.log(JSON.stringify({ drc: res.board.drc, trips: W.trips.map((t) => t.file + ":" + t.ok), compare: res.compare, T: res.sim.thermometry.T, sigmaT: res.sim.thermometry.sigmaT, seconds: res.seconds }));
};

/* the board as plain data for the page (footprints inlined by name) */
const boardRecord = (B) => ({ id: B.id, hash: B.hash, w: B.w, h: B.h, rules: B.rules, classes: B.classes, nets: B.nets, traces: B.traces, vias: B.vias, pourRects: B.pourRects,
  parts: B.parts.map((P) => ({ ref: P.ref, value: P.value, at: P.at, rot: P.rot, side: P.side, fp: P.fp, comp: { pins: P.comp.pins, desc: P.comp.desc }, pn: P.pn, pnStatus: P.pnStatus, bridge: P.bridge })), fab: { F_Silk: B.fab.F_Silk } });

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { traceR, boardRecord };
