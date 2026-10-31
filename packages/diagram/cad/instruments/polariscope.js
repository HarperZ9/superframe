// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Photoelastic polariscope: the parametric model. Sources: packages/instruments records/polariscope.json,
   examples/polariscope.json and PIPELINE.md worked example 3. Disc stresses after Frocht (1941). The fringe constant of polycarbonate and its
   yield stress are from memory (moderate); the disc calibration measures the first. Nothing is bought. */
(function (g) {
  "use strict";
  const D = g.Diagram, C = D.CAD;
  const REC = C.record("polariscope");
  /* label, unit and default come from the record; the range and step are this view's controls */
  const P = (id, min, max, step, x) => Object.assign({ id, min, max, step }, x);

  /* Stress along the horizontal diameter of a disc of diameter Dm (mm), thickness t (mm), load P (N): MPa. */
  const disc = {
    sx: (x, P, Dm, t) => ((2 * P) / (Math.PI * t * Dm)) * ((Dm * Dm - 4 * x * x) / (Dm * Dm + 4 * x * x)) ** 2,
    sy: (x, P, Dm, t) => -((2 * P) / (Math.PI * t * Dm)) * ((4 * Dm ** 4) / (Dm * Dm + 4 * x * x) ** 2 - 1),
  };
  const N = (x, p) => (p.t / p.fs) * (disc.sx(x, p.P, p.D, p.t) - disc.sy(x, p.P, p.D, p.t));
  const N0 = (P, Dm, fs) => (8 * P) / (Math.PI * Dm * fs);

  const inst = {
    id: "polariscope", file: "cad-polariscope.html", region: "print", super: "N",
    message: "The polariscope's frame, disc, analyser and phone come from one model, so turning the analyser or loading the disc redraws the jig, the optical train and the fringe count together.",
    lede: "Load a polycarbonate disc between two platens, turn the analyser, and watch the fringe order at the centre follow 8P / (pi D f).",
    scale3d: 0.025, camera: { yaw: 0.55, pitch: 0.32, zoom: 2.0 }, disc, N, N0,
    params: [
      P("D", 20, 80, 1), P("t", 1, 6, 0.5), P("P", 0, 300, 1),
      P("fs", 3, 15, 0.1), P("theta", 0, 90, 1),
      P("frameW", 120, 240, 1), P("frameH", 120, 240, 1),
    ],
  };

  inst.build = (p) => {
    const parts = [], W = p.frameW, H = p.frameH, part = (o) => parts.push(Object.assign({ material: "aluminium" }, o));
    const cy = 18 + p.D / 2, topY = 18 + p.D + 6, barY = 12 + H + 6, rodTop = barY + 6 + 14, rodL = rodTop - topY, panY = rodTop + 2;
    const fits = [{ what: "disc and platens under the crossbar", ok: barY - 6 - topY >= 10, need: "10 mm clear", have: (barY - 6 - topY).toFixed(0) + " mm" },
      { what: "disc between the uprights", ok: W - 24 - p.D >= 20, need: "20 mm clear", have: (W - 24 - p.D).toFixed(0) + " mm" }];
    part({ id: "base", label: "Base plate", alt: "A flat aluminium plate the frame stands on.", fn: "Carries the frame and the bottom platen.", geom: { t: "box", size: [W, 12, 60] }, pos: [0, 6, 0], explode: { axis: [0, -1, 0], dist: 0 } });
    for (const s of [-1, 1]) part({ id: s < 0 ? "upL" : "upR", label: s < 0 ? "Left upright" : "Right upright", alt: "A vertical aluminium bar at one side of the frame.", fn: "Holds the crossbar and guides the load rod.", geom: { t: "box", size: [12, H, 20] }, pos: [s * (W / 2 - 6), 12 + H / 2, 0], explode: { axis: [s, 0, 0], dist: 40 } });
    part({ id: "bar", label: "Slotted crossbar", alt: "A horizontal bar across the top with a slot in the middle.", fn: "Guides the load rod so the load stays on the disc's vertical diameter.", geom: { t: "group", items: [-1, 1].map((s) => ({ t: "box", size: [W / 2 - 5, 12, 20], pos: [s * (W / 4 + 2.5), 0, 0] })) }, pos: [0, barY, 0], explode: { axis: [0, 1, 0], dist: 60 } });
    part({ id: "platB", label: "Bottom platen", alt: "A small steel block under the disc.", fn: "Applies the reaction at the bottom of the diameter.", material: "steel", geom: { t: "box", size: [30, 6, 14] }, pos: [0, 15, 0], explode: { axis: [0, -1, 0], dist: 14 } });
    part({ id: "disc", label: "Specimen disc", alt: "A clear plastic disc standing on edge between the platens.", fn: "Its birefringence under load is the reading; a disc is the analytic calibration specimen.", material: "polycarbonate", geom: { t: "cyl", r: p.D / 2, h: p.t, axis: "z", seg: 64 }, pos: [0, cy, 0], explode: { axis: [0, 0, 1], dist: 50 } });
    part({ id: "platT", label: "Top platen", alt: "A small steel block on top of the disc.", fn: "Applies the load at the top of the diameter.", material: "steel", geom: { t: "box", size: [30, 6, 14] }, pos: [0, topY - 3, 0], explode: { axis: [0, 1, 0], dist: 24 } });
    part({ id: "rod", label: "Load rod", alt: "A steel rod rising from the top platen through the crossbar slot.", fn: "Carries the weight of the pan and bottles down to the disc.", material: "steel", geom: { t: "cyl", r: 4, h: rodL, seg: 24 }, pos: [0, topY + rodL / 2, 0], explode: { axis: [0, 1, 0], dist: 70 } });
    part({ id: "pan", label: "Weight pan", alt: "A flat tray on top of the rod.", fn: "Takes water bottles; load P = m g.", geom: { t: "box", size: [W - 40, 4, 50] }, pos: [0, panY, 0], explode: { axis: [0, 1, 0], dist: 90 } });
    part({ id: "screen", label: "Laptop screen", alt: "A large flat panel behind the frame showing white.", fn: "The light source and the polariser in one: an LCD's light leaves linearly polarised.", material: "glass", geom: { t: "box", size: [W + 80, H + 60, 6] }, pos: [0, 12 + H / 2, -80], explode: { axis: [0, 0, -1], dist: 60 } });
    const ay = cy;
    part({ id: "sheet", label: "Analyser sheet", alt: "A thin dark square of polariser film in front of the disc.", fn: "Crossed with the screen's own polariser, it passes only light the disc has turned.", material: "polariser", geom: { t: "box", size: [50, 50, 0.5] }, pos: [0, ay, 60], explode: { axis: [0, 0, 1], dist: 40 } });
    part({ id: "tick", label: "Analyser index", alt: "A thin line printed across the analyser, tilted at the analyser angle.", fn: "Marks the analyser's transmission axis; its angle from vertical is the setting.", material: "plastic", geom: { t: "box", size: [1.2, 40, 0.8] }, pos: [0, ay, 60.7], rot: [0, 0, p.theta], explode: { axis: [0, 0, 1], dist: 46 } });
    part({ id: "stand", label: "Analyser post", alt: "A thin post holding the analyser.", fn: "Holds the analyser square to the line of sight.", material: "steel", geom: { t: "cyl", r: 3, h: ay - 25, seg: 16 }, pos: [0, (ay - 25) / 2, 60], explode: { axis: [0, -1, 1], dist: 30 } });
    part({ id: "phone", label: "Phone camera", alt: "A phone held sideways facing the disc.", fn: "The detector: RAW frames at fixed exposure and white balance.", material: "electronics", geom: { t: "group", items: [{ t: "box", size: [150, 72, 8] }, { t: "cyl", r: 5, h: 2, axis: "z", seg: 24, pos: [0, 0, -5] }] }, pos: [0, Math.max(ay, 38), 160], explode: { axis: [0, 0, 1], dist: 60 } });
    const items = [
      { item: 1, desc: "Base plate", material: "Aluminium", parts: ["base"] }, { item: 2, desc: "Upright", material: "Aluminium", parts: ["upL", "upR"] },
      { item: 3, desc: "Crossbar, slotted", material: "Aluminium", parts: ["bar"] }, { item: 4, desc: "Platen", material: "Steel", parts: ["platB", "platT"] },
      { item: 5, desc: "Specimen disc, annealed", material: "Polycarbonate", pn: "PC sheet " + p.t + " mm", pnStatus: "commodity", parts: ["disc"] },
      { item: 6, desc: "Load rod M8", material: "Steel", pnStatus: "commodity", parts: ["rod"] }, { item: 7, desc: "Weight pan", material: "Aluminium", parts: ["pan"] },
      { item: 8, desc: "Analyser: film and index", material: "Polariser film", pn: "linear polariser sheet", pnStatus: "commodity", parts: ["sheet", "tick"] },
      { item: 9, desc: "Analyser post", material: "Steel", parts: ["stand"] },
      { item: 10, desc: "Laptop screen (light source)", material: "-", pn: "existing", pnStatus: "existing device", parts: ["screen"] },
      { item: 11, desc: "Phone camera (detector)", material: "-", pn: "existing", pnStatus: "existing device", parts: ["phone"] },
    ];
    const assembly = { id: "pol", label: "Polariscope", children: [
      { id: "frame", label: "Load frame", children: ["base", "upL", "upR", "bar", "platB", "platT", "rod", "pan"] },
      { id: "spec", label: "Specimen", children: ["disc"] }, { id: "an", label: "Analyser", children: ["sheet", "tick", "stand"] },
      { id: "dev", label: "Existing devices", children: ["screen", "phone"] }] };
    const components = [
      { ref: "L1", sym: "SRC", value: "LCD, white then green", part: "screen", desc: "Polarised source", pins: { o: "B1" } },
      { ref: "S1", sym: "SPEC", value: "PC disc " + p.D + " x " + p.t, part: "disc", desc: "Specimen under " + p.P + " N", pins: { i: "B1", o: "B2" } },
      { ref: "P1", sym: "POL", value: "analyser " + p.theta + " deg", part: "sheet", desc: "Analyser", pins: { i: "B2", o: "B3" } },
      { ref: "CAM1", sym: "CAM", value: "phone RAW", part: "phone", desc: "Detector", pins: { i: "B3" } },
    ];
    const G = 2.54, at = (x, y) => [x * G, y * G, 0];
    const dims = [
      { id: "W", view: "front", kind: "x", part: "base", tol: { pm: 0.5 }, expect: W, param: "frameW", tier: 1 },
      { id: "Dd", view: "front", kind: "x", part: "disc", prefix: "Ø", tol: { pm: 0.1 }, expect: p.D, param: "D", at: "hi", tier: 1 },
      { id: "t", view: "top", kind: "y", part: "disc", tol: { pm: 0.1 }, expect: p.t, param: "t" },
      { id: "Hc", view: "front", kind: "gap", axis: "v", a: { part: "base", side: "lo" }, b: { part: "bar", side: "lo" }, tol: { pm: 0.5 }, expect: 12 + H, param: "frameH" },
      { id: "theta", view: "front", kind: "angle", part: "tick", tol: { pm: 1 }, expect: p.theta, param: "theta" },
    ];
    return {
      parts, fits, items, assembly,
      netlist: { components, nets: ["B1", "B2", "B3"].map((name) => ({ name, kind: "optical" })) },
      sch: { title: "POLARISCOPE, OPTICAL TRAIN", number: "POL-SCH-001", place: { L1: at(50, 50), S1: at(70, 50), P1: at(90, 50), CAM1: at(110, 50) } },
      drawing: {
        number: "POL-ASM-001", title: "PHOTOELASTIC POLARISCOPE", rev: "A",
        views: { front: { skip: ["phone", "sheet", "stand"] }, top: {}, right: {}, iso: {}, section: { cut: { n: [0, 0, 1], d: 0 }, label: "A", from: "top", skip: ["phone", "screen", "sheet", "tick", "stand"] } },
        dims, datums: [{ letter: "A", view: "front", part: "base", side: "bottom" }],
        notes: ["Dimensions in millimetres; interpret per ASME Y14.5-2018.", "Front view drawn with the phone and analyser removed.", "Anneal the disc before use; photograph it unloaded first.", "The screen and the phone are existing devices.", "Nothing is ordered, priced or fabricated from this sheet."],
      },
    };
  };

  inst.physics = (p) => {
    const F = inst.fixed, n0 = N0(p.P, p.D, p.fs), sc = (6 * p.P) / (Math.PI * p.D * p.t), th = (p.theta * Math.PI) / 180;
    const xs = Float32Array.from({ length: 201 }, (_, i) => -p.D / 2 + (i / 200) * p.D), Nx = Float32Array.from(xs, (x) => N(x, p));
    const sMax = (F.whiteOrders * p.fs) / p.t, ss = Float32Array.of(0, sMax * 1.2);
    return {
      v: { n0, sc, sMax, Pmax: (F.whiteOrders * Math.PI * p.D * p.fs) / 8, litres: p.P / F.g },
      readouts: [
        ["Fringe order at the centre", n0.toPrecision(3)], ["Stress difference at the centre", ((n0 * p.fs) / p.t).toPrecision(3) + " MPa"],
        ["Centre compressive stress against yield", sc.toPrecision(3) + " of " + F.yieldMPa + " MPa (yield from memory)"],
        ["Load in water", (p.P / F.g).toPrecision(3) + " kg"], ["Load for 4.5 orders", ((F.whiteOrders * Math.PI * p.D * p.fs) / 8).toPrecision(3) + " N"],
        ["Stress resolution, colour", ((F.colourRes * p.fs) / p.t).toPrecision(2) + " MPa"], ["Isoclinic factor sin^2 2 theta", Math.sin(2 * th) ** 2 > 1e-12 ? (Math.sin(2 * th) ** 2).toPrecision(3) : "0, extinction"],
      ],
      panels: [
        { title: "Fringe order along the horizontal diameter", x: { min: -p.D / 2, max: p.D / 2, label: "mm" }, y: { min: 0, max: Math.max(1, n0 * 1.1), label: "N" }, cursor: 0, series: [{ name: "N(x)", x: xs, y: Nx, tok: "s2", width: 2 }] },
        { title: "Light through the analyser along the diameter", x: { min: -p.D / 2, max: p.D / 2, label: "mm" }, y: { min: 0, max: 1.05, label: "I / I0" }, series: [{ name: "plane, at theta", x: xs, y: Float32Array.from(Nx, (n) => Math.sin(2 * th) ** 2 * Math.sin(Math.PI * n) ** 2), tok: "s1", width: 2 }, { name: "circular", x: xs, y: Float32Array.from(Nx, (n) => Math.sin(Math.PI * n) ** 2), tok: "s2", dash: true }] },
        { title: "Fringe order against stress difference (cursor: the centre now)", x: { min: 0, max: sMax * 1.2, label: "MPa" }, y: { min: 0, max: F.whiteOrders * 1.2, label: "N" }, cursor: (n0 * p.fs) / p.t, series: [{ name: "N = t (s1 - s2) / f", x: ss, y: Float32Array.from(ss, (s) => (p.t * s) / p.fs), tok: "s2", width: 2 }, { name: "white-light limit", x: ss, y: Float32Array.of(F.whiteOrders, F.whiteOrders), tok: "soft", dash: true }] },
      ],
    };
  };

  inst.spec = (p, ph) => ({
    budgetUnit: "fringe orders",
    ranges: [
      { quantity: "Fringe order", min: 0, max: inst.fixed.whiteOrders, unit: "orders", limit: "white-light colours wash out past 4 to 5 orders (from memory, moderate)" },
      { quantity: "Stress difference", min: 0, max: ph.v.sMax, unit: "MPa", limit: "4.5 f / t" },
      { quantity: "Load on this disc", min: 0, max: ph.v.Pmax, unit: "N", limit: "the centre reaches 4.5 orders" },
      { quantity: "Analyser angle", min: 0, max: 90, unit: "deg", limit: "isoclinics repeat every 90 degrees" },
    ],
    budget: [
      { term: "Colour ambiguity between orders", value: inst.fixed.colourRes, basis: "estimated (pipeline stage 3)", note: "phase stepping brings it to 0.02" },
      { term: "Camera noise after spatial averaging", value: 0.02, basis: "estimated (pipeline stage 3)", note: "" },
      { term: "Thickness tolerance, 0.1 mm", value: ph.v.n0 * (0.1 / p.t), basis: "computed", note: "N scales with t" },
      { term: "Load, bottle mass to 1 percent", value: ph.v.n0 * 0.01, basis: "computed, assumed 1 percent", note: "weigh the bottles" },
      { term: "Fringe constant f", value: null, basis: "unknown", note: "set by the disc calibration; memory value " + p.fs + " N/mm" },
      { term: "Residual moulding stress", value: null, basis: "unknown", note: "subtract the unloaded image" },
    ],
  });

  inst.checks = () => {
    const q = { D: 40, t: 3, P: 100, fs: 7 };
    return [
      { name: "disc centre: N(0) from the stress field equals 8P / (pi D f) (Frocht)", got: N(0, q), want: N0(100, 40, 7), tol: 1e-12 },
      { name: "disc centre fringe order at 100 N, 40 mm, 7 N/mm is 0.909", got: N0(100, 40, 7), want: 0.9095, tol: 1e-3 },
      { name: "disc edge on the horizontal diameter is stress-free (N = 0)", got: N(20, q), want: 0, tol: 1e-12 },
    ];
  };

  C.register(C.fromRecord(inst, REC));
  if (typeof module !== "undefined" && module.exports) module.exports = inst;
})(typeof globalThis !== "undefined" ? globalThis : this);
